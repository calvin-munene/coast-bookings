import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { addHours } from "date-fns";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import {
  bookingItems,
  bookingPaymentSchedules,
  bookingPriceItems,
  bookings,
  bookingStatusHistory,
  groupEnquiries,
  groupParticipants,
  groupQuoteOptions,
  groupQuotes,
  inventoryHolds,
  outboxEvents,
  pricingSnapshots,
  properties,
  units,
  type users,
} from "@/db/schema";

type ApplicationUser = typeof users.$inferSelect;

export type GroupQuoteView = Readonly<{
  quoteId: string;
  reference: string;
  organisationName: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  expiresAt: Date;
  options: readonly Readonly<{
    id: string;
    title: string;
    propertyName: string;
    unitName: string;
    roomingArrangement: string;
    inclusions: readonly string[];
    exclusions: readonly string[];
    totalMinor: number;
    depositMinor: number;
    cancellationPolicy: string;
  }>[];
}>;

function tokenMatches(token: string, expectedHash: string | null): boolean {
  if (!expectedHash || token.length < 32 || token.length > 256) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getGroupQuoteForAcceptance(reference: string, token: string, user: ApplicationUser): Promise<GroupQuoteView | null> {
  const [row] = await getDb().select({ quote: groupQuotes, enquiry: groupEnquiries })
    .from(groupQuotes)
    .innerJoin(groupEnquiries, eq(groupEnquiries.id, groupQuotes.enquiryId))
    .where(eq(groupQuotes.reference, reference))
    .orderBy(sql`${groupQuotes.version} desc`)
    .limit(1);
  if (!row || !tokenMatches(token, row.quote.acceptanceTokenHash) || !["SENT", "ACCEPTED"].includes(row.quote.status)) return null;
  const intendedEmail = row.enquiry.contact.email?.trim().toLowerCase();
  if (intendedEmail && intendedEmail !== user.primaryEmail.trim().toLowerCase()) return null;
  const options = await getDb().select({ option: groupQuoteOptions, propertyName: properties.name, unitName: units.name })
    .from(groupQuoteOptions)
    .innerJoin(properties, eq(properties.id, groupQuoteOptions.propertyId))
    .innerJoin(units, eq(units.id, groupQuoteOptions.unitId))
    .where(eq(groupQuoteOptions.quoteId, row.quote.id))
    .orderBy(groupQuoteOptions.sortOrder);
  return {
    quoteId: row.quote.id,
    reference: row.quote.reference,
    organisationName: row.enquiry.organisationName,
    destination: row.enquiry.destination,
    checkIn: row.enquiry.checkIn,
    checkOut: row.enquiry.checkOut,
    expiresAt: row.quote.expiresAt,
    options: options.map(({ option, propertyName, unitName }) => ({
      id: option.id,
      title: option.title,
      propertyName,
      unitName,
      roomingArrangement: option.roomingArrangement,
      inclusions: option.inclusions,
      exclusions: option.exclusions,
      totalMinor: Number(option.totalMinor),
      depositMinor: Number(option.depositMinor),
      cancellationPolicy: option.cancellationPolicy,
    })),
  };
}

export async function acceptGroupQuote(input: Readonly<{
  reference: string;
  optionId: string;
  token: string;
  acceptedByName: string;
  acceptedIp: string | null;
  user: ApplicationUser;
}>): Promise<{ bookingId: string; bookingReference: string }> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select id from group_quotes where reference = ${input.reference} order by version desc limit 1 for update`);
    const [row] = await tx.select({ quote: groupQuotes, enquiry: groupEnquiries, option: groupQuoteOptions, property: properties, unit: units })
      .from(groupQuotes)
      .innerJoin(groupEnquiries, eq(groupEnquiries.id, groupQuotes.enquiryId))
      .innerJoin(groupQuoteOptions, and(eq(groupQuoteOptions.quoteId, groupQuotes.id), eq(groupQuoteOptions.id, input.optionId)))
      .innerJoin(properties, eq(properties.id, groupQuoteOptions.propertyId))
      .innerJoin(units, eq(units.id, groupQuoteOptions.unitId))
      .where(eq(groupQuotes.reference, input.reference))
      .orderBy(sql`${groupQuotes.version} desc`)
      .limit(1);
    if (!row || !tokenMatches(input.token, row.quote.acceptanceTokenHash)) throw new Error("This quotation link is invalid");
    if (row.quote.bookingId) {
      const [existing] = await tx.select({ id: bookings.id, reference: bookings.reference }).from(bookings).where(eq(bookings.id, row.quote.bookingId)).limit(1);
      if (existing) return { bookingId: existing.id, bookingReference: existing.reference };
    }
    if (row.quote.status !== "SENT" || row.quote.expiresAt <= new Date()) throw new Error("This quotation is no longer available");
    const intendedEmail = row.enquiry.contact.email?.trim().toLowerCase();
    if (intendedEmail && intendedEmail !== input.user.primaryEmail.trim().toLowerCase()) throw new Error("Sign in with the email address that received this quotation");
    if (row.property.status !== "PUBLISHED" || !row.property.verifiedAt) throw new Error("The selected property is no longer available");
    if (!row.option.holdId) throw new Error("The selected quotation option has no inventory reservation");
    const [hold] = await tx.select().from(inventoryHolds).where(eq(inventoryHolds.id, row.option.holdId)).limit(1);
    if (!hold || hold.status !== "ACTIVE" || hold.expiresAt <= new Date()) throw new Error("The selected option has expired; ask Coast Bookings for a refreshed quotation");

    const paymentDeadline = addHours(new Date(), 24);
    await tx.update(inventoryHolds).set({ expiresAt: paymentDeadline }).where(eq(inventoryHolds.id, hold.id));
    const otherOptions = await tx.select({ holdId: groupQuoteOptions.holdId }).from(groupQuoteOptions)
      .where(and(eq(groupQuoteOptions.quoteId, row.quote.id), ne(groupQuoteOptions.id, row.option.id)));
    for (const option of otherOptions) {
      if (option.holdId) await tx.execute(sql`select public.release_inventory_hold(${option.holdId}::uuid, 'GROUP_OPTION_NOT_SELECTED'::text)`);
    }

    const bookingReference = `CBG-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const commissionMinor = (row.option.totalMinor * 1200n) / 10_000n;
    const [booking] = await tx.insert(bookings).values({
      reference: bookingReference,
      guestUserId: input.user.id,
      hostOrganizationId: row.property.hostOrganizationId,
      propertyId: row.property.id,
      hostId: row.property.hostId,
      holdId: hold.id,
      bookingMode: "GROUP_QUOTE",
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      checkIn: row.enquiry.checkIn,
      checkOut: row.enquiry.checkOut,
      adults: row.option.adults,
      children: row.option.children,
      guestRequirements: row.option.roomingArrangement,
      cancellationPolicySnapshot: { type: "CUSTOM_GROUP_POLICY", text: row.option.cancellationPolicy, quoteReference: row.quote.reference, quoteVersion: row.quote.version },
      source: "GROUP_QUOTE",
    }).returning({ id: bookings.id });
    await tx.insert(bookingItems).values({ bookingId: booking.id, unitId: row.option.unitId, quantity: row.option.quantity, adults: row.option.adults, children: row.option.children, totalMinor: row.option.totalMinor });
    const [snapshot] = await tx.insert(pricingSnapshots).values({
      bookingId: booking.id,
      guestTotalMinor: row.option.totalMinor,
      hostEarningsMinor: row.option.totalMinor - commissionMinor,
      commissionMinor,
      inputSnapshot: { groupQuoteId: row.quote.id, groupQuoteOptionId: row.option.id, roomingArrangement: row.option.roomingArrangement, inclusions: row.option.inclusions, exclusions: row.option.exclusions },
    }).returning({ id: pricingSnapshots.id });
    await tx.insert(bookingPriceItems).values({ snapshotId: snapshot.id, code: "GROUP_PACKAGE", label: row.option.title, kind: "ACCOMMODATION", amountMinor: row.option.totalMinor, metadata: { quoteReference: row.quote.reference } });
    const firstPayment = row.option.depositMinor > 0n ? row.option.depositMinor : row.option.totalMinor;
    await tx.insert(bookingPaymentSchedules).values({ bookingId: booking.id, sequence: 1, label: firstPayment < row.option.totalMinor ? "Group booking deposit" : "Group booking payment", amountMinor: firstPayment, dueAt: paymentDeadline });
    if (firstPayment < row.option.totalMinor) {
      const balanceDueAt = new Date(`${row.option.balanceDueOn ?? row.enquiry.checkIn}T09:00:00+03:00`);
      await tx.insert(bookingPaymentSchedules).values({ bookingId: booking.id, sequence: 2, label: "Group booking balance", amountMinor: row.option.totalMinor - firstPayment, dueAt: balanceDueAt > paymentDeadline ? balanceDueAt : addHours(paymentDeadline, 48) });
    }
    await tx.update(groupQuotes).set({ status: "ACCEPTED", acceptedOptionId: row.option.id, acceptedByName: input.acceptedByName, acceptedAt: new Date(), acceptedIp: input.acceptedIp, bookingId: booking.id, updatedAt: new Date() }).where(eq(groupQuotes.id, row.quote.id));
    await tx.update(groupEnquiries).set({ status: "CONVERTED_TO_BOOKING", coordinatorId: input.user.id, updatedAt: new Date() }).where(eq(groupEnquiries.id, row.enquiry.id));
    await tx.update(groupParticipants).set({ bookingId: booking.id, updatedAt: new Date() }).where(eq(groupParticipants.enquiryId, row.enquiry.id));
    await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, toStatus: "AWAITING_PAYMENT", actorId: input.user.id, reason: `Accepted group quotation ${row.quote.reference}` });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "GROUP_QUOTE_ACCEPTED", aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id, quoteId: row.quote.id, reference: bookingReference } });
    return { bookingId: booking.id, bookingReference };
  });
}
