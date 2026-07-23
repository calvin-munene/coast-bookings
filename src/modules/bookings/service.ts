import "server-only";

import { addMinutes } from "date-fns";
import { and, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb } from "@/db/connection";
import { bookingItems, bookingPaymentSchedules, bookingPriceItems, bookings, bookingStatusHistory, inventoryHolds, outboxEvents, pricingSnapshots } from "@/db/schema";
import type { CreateBookingInput } from "./validators";
import { calculateBookingQuote } from "./quote-service";

const referencePart = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export type CreatedBooking = Readonly<{ id: string; reference: string; status: "AWAITING_PAYMENT" | "PENDING_HOST_APPROVAL"; totalMinor: number; currency: "KES"; expiresAt: string }>;

export async function createBooking(userId: string, input: CreateBookingInput): Promise<CreatedBooking> {
  const existing = await getDb().select({ id: bookings.id, reference: bookings.reference, status: bookings.status, total: pricingSnapshots.guestTotalMinor, expiresAt: inventoryHolds.expiresAt })
    .from(inventoryHolds).innerJoin(bookings, eq(bookings.holdId, inventoryHolds.id)).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id))
    .where(and(eq(inventoryHolds.idempotencyKey, input.idempotencyKey), eq(bookings.guestUserId, userId))).limit(1);
  if (existing[0]) return { id: existing[0].id, reference: existing[0].reference, status: existing[0].status === "PENDING_HOST_APPROVAL" ? "PENDING_HOST_APPROVAL" : "AWAITING_PAYMENT", totalMinor: Number(existing[0].total), currency: "KES", expiresAt: existing[0].expiresAt.toISOString() };

  const quote = await calculateBookingQuote(input);
  const requestToBook = quote.unit.bookingMode === "REQUEST_TO_BOOK";
  const expiresAt = addMinutes(new Date(), requestToBook ? 24 * 60 : 20);
  const bookingStatus = requestToBook ? "PENDING_HOST_APPROVAL" as const : "AWAITING_PAYMENT" as const;
  const reference = `CB-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${referencePart()}`;

  return getDb().transaction(async (tx) => {
    const holdResult = await tx.execute<{ hold_id: string }>(sql`select public.create_inventory_hold(${userId}::uuid, ${quote.unit.id}::uuid, ${quote.checkIn}::date, ${quote.checkOut}::date, ${quote.rooms}::int, ${expiresAt}::timestamptz, ${input.idempotencyKey}::text) as hold_id`);
    const holdId = holdResult[0]?.hold_id;
    if (!holdId) throw new Error("Inventory hold could not be created");
    const [booking] = await tx.insert(bookings).values({
      reference,
      guestUserId: userId,
      hostOrganizationId: quote.property.hostOrganizationId,
      propertyId: quote.property.id,
      hostId: quote.property.hostId,
      holdId,
      bookingMode: quote.unit.bookingMode,
      status: bookingStatus,
      paymentStatus: "PENDING",
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      adults: quote.adults,
      children: quote.children,
      guestRequirements: input.guestRequirements,
      cancellationPolicySnapshot: quote.cancellationPolicy,
    }).returning({ id: bookings.id });
    await tx.insert(bookingItems).values({ bookingId: booking.id, unitId: quote.unit.id, quantity: quote.rooms, adults: quote.adults, children: quote.children, totalMinor: BigInt(quote.guestTotalMinor) });
    const [snapshot] = await tx.insert(pricingSnapshots).values({
      bookingId: booking.id,
      guestTotalMinor: BigInt(quote.guestTotalMinor),
      hostEarningsMinor: BigInt(quote.hostExpectedEarningsMinor),
      commissionMinor: BigInt(quote.commissionMinor),
      inputSnapshot: { unitId: quote.unit.id, checkIn: quote.checkIn, checkOut: quote.checkOut, adults: quote.adults, children: quote.children, rooms: quote.rooms, nights: quote.nights },
    }).returning({ id: pricingSnapshots.id });
    await tx.insert(bookingPriceItems).values(quote.items.map((item) => ({ snapshotId: snapshot.id, code: item.code, label: item.label, kind: item.kind, amountMinor: BigInt(item.amountMinor) })));
    await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, toStatus: bookingStatus, actorId: userId, reason: requestToBook ? "Guest submitted request to book" : "Guest created an instant booking hold" });
    await tx.insert(bookingPaymentSchedules).values({ bookingId: booking.id, sequence: 1, label: "Booking payment", amountMinor: BigInt(quote.guestTotalMinor), dueAt: requestToBook ? addMinutes(expiresAt, 12 * 60) : expiresAt });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: requestToBook ? "BOOKING_REQUESTED" : "BOOKING_AWAITING_PAYMENT", aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id, reference } });
    return { id: booking.id, reference, status: bookingStatus, totalMinor: quote.guestTotalMinor, currency: "KES" as const, expiresAt: expiresAt.toISOString() };
  });
}
