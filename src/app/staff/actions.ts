"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { auditLogs, bookingPaymentSchedules, bookingPriceItems, bookings, disputes, groupEnquiries, groupQuoteOptions, groupQuotes, hostDocuments, hostOrganizations, hostProfiles, ledgerEntries, ledgerJournals, outboxEvents, payments, payoutAccounts, payouts, pricingSnapshots, properties, refunds, supportTickets, ticketMessages, units, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { confirmPaidBooking } from "@/modules/bookings/confirmation-service";
import { createBooking } from "@/modules/bookings/service";
import { requireInternalPermission, requireRecentReverification } from "@/modules/authorization/service";
import { calculateRefund } from "@/modules/refunds/service";

export async function reviewProperty(formData: FormData): Promise<void> {
  const input = z.object({ propertyId: z.string().uuid(), decision: z.enum(["PUBLISH", "REQUEST_CHANGES", "SUSPEND", "REJECT"]), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:properties:approve");
  const [row] = await getDb().select({ property: properties, organization: hostOrganizations }).from(properties).innerJoin(hostOrganizations, eq(hostOrganizations.id, properties.hostOrganizationId)).where(eq(properties.id, input.propertyId)).limit(1);
  if (!row) throw new Error("Property was not found");
  const property = row.property;
  const status = input.decision === "PUBLISH" ? "PUBLISHED" as const : input.decision === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" as const : input.decision === "SUSPEND" ? "SUSPENDED" as const : "REJECTED" as const;
  if (input.decision === "PUBLISH" && (! ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"].includes(property.status) || row.organization.status !== "VERIFIED")) throw new Error("Only reviewed properties belonging to a verified host can be published");
  await getDb().transaction(async (tx) => {
    await tx.update(properties).set({ status, verifiedAt: status === "PUBLISHED" ? property.verifiedAt ?? new Date() : property.verifiedAt, publishedAt: status === "PUBLISHED" ? new Date() : property.publishedAt, updatedAt: new Date(), version: property.version + 1 }).where(and(eq(properties.id, property.id), eq(properties.version, property.version)));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: `PROPERTY_${status}`, entityType: "property", entityId: property.id, oldValue: { status: property.status }, newValue: { status }, reason: input.reason });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: `PROPERTY_${status}`, aggregateType: "property", aggregateId: property.id, payload: { propertyId: property.id, reason: input.reason } });
  });
  revalidatePath("/staff/property-verification"); revalidatePath("/"); revalidatePath("/search");
}

export async function progressGroupEnquiry(formData: FormData): Promise<void> {
  const input = z.object({ enquiryId: z.string().uuid(), status: z.enum(["REQUIREMENTS_CONFIRMED", "SOURCING_PROPERTIES", "AWAITING_HOST_RESPONSES", "PREPARING_QUOTE", "QUOTE_SENT", "NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED"]), note: z.string().trim().max(1000).default("") }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:enquiries:manage");
  const [enquiry] = await getDb().select().from(groupEnquiries).where(eq(groupEnquiries.id, input.enquiryId)).limit(1);
  if (!enquiry || ["CONVERTED_TO_BOOKING", "DECLINED", "EXPIRED"].includes(enquiry.status)) throw new Error("Enquiry cannot be progressed from its current state");
  await getDb().transaction(async (tx) => {
    await tx.update(groupEnquiries).set({ status: input.status, assignedTo: enquiry.assignedTo ?? context.user.id, updatedAt: new Date() }).where(eq(groupEnquiries.id, enquiry.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "GROUP_ENQUIRY_STATUS_CHANGED", entityType: "group_enquiry", entityId: enquiry.id, oldValue: { status: enquiry.status }, newValue: { status: input.status }, reason: input.note || null });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "GROUP_ENQUIRY_UPDATED", aggregateType: "group_enquiry", aggregateId: enquiry.id, payload: { enquiryId: enquiry.id, status: input.status } });
  });
  revalidatePath("/staff/group-enquiries"); revalidatePath("/staff/crm");
}

export async function addGroupQuoteOption(formData: FormData): Promise<void> {
  const input = z.object({ enquiryId: z.string().uuid(), unitId: z.string().uuid(), title: z.string().trim().min(5).max(160), roomingArrangement: z.string().trim().min(10).max(2000), quantity: z.coerce.number().int().min(1).max(200), totalMinor: z.coerce.number().int().min(1), depositMinor: z.coerce.number().int().min(0), cancellationPolicy: z.string().trim().min(10).max(2000), inclusions: z.string().trim().max(2000).default(""), exclusions: z.string().trim().max(2000).default("") }).refine((value) => value.depositMinor <= value.totalMinor, { message: "Deposit cannot exceed total", path: ["depositMinor"] }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:quotes:create");
  const [row] = await getDb().select({ enquiry: groupEnquiries, unit: units, property: properties }).from(groupEnquiries).innerJoin(units, eq(units.id, input.unitId)).innerJoin(properties, eq(properties.id, units.propertyId)).where(eq(groupEnquiries.id, input.enquiryId)).limit(1);
  if (!row || row.property.status !== "PUBLISHED" || !row.property.verifiedAt) throw new Error("Select a verified published property");
  if (input.quantity > row.unit.quantity) throw new Error("Option quantity exceeds the unit's configured inventory");
  const expiresAt = addDays(new Date(), 5);
  await getDb().transaction(async (tx) => {
    const [existingQuote] = await tx.select().from(groupQuotes).where(and(eq(groupQuotes.enquiryId, row.enquiry.id), eq(groupQuotes.status, "DRAFT"))).limit(1);
    const quote = existingQuote ?? (await tx.insert(groupQuotes).values({ enquiryId: row.enquiry.id, reference: `CBQ-${Date.now().toString(36).toUpperCase()}`, version: 1, status: "DRAFT", expiresAt }).returning())[0];
    const holdResult = await tx.execute<{ hold_id: string }>(sql`select public.create_inventory_hold(${row.enquiry.coordinatorId}::uuid, ${row.unit.id}::uuid, ${row.enquiry.checkIn}::date, ${row.enquiry.checkOut}::date, ${input.quantity}::int, ${quote.expiresAt}::timestamptz, ${`quote-${quote.id}-${row.unit.id}`}::text) as hold_id`);
    const holdId = holdResult[0]?.hold_id;
    if (!holdId) throw new Error("Could not reserve inventory for this quotation option");
    await tx.insert(groupQuoteOptions).values({ quoteId: quote.id, propertyId: row.property.id, unitId: row.unit.id, quantity: input.quantity, adults: row.enquiry.adults + row.enquiry.supervisors, children: row.enquiry.children, title: input.title, roomingArrangement: input.roomingArrangement, inclusions: input.inclusions.split("\n").map((value) => value.trim()).filter(Boolean), exclusions: input.exclusions.split("\n").map((value) => value.trim()).filter(Boolean), totalMinor: BigInt(input.totalMinor), depositMinor: BigInt(input.depositMinor), balanceDueOn: row.enquiry.checkIn, cancellationPolicy: input.cancellationPolicy, holdId });
    await tx.update(groupEnquiries).set({ status: "PREPARING_QUOTE", assignedTo: row.enquiry.assignedTo ?? context.user.id, updatedAt: new Date() }).where(eq(groupEnquiries.id, row.enquiry.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "GROUP_QUOTE_OPTION_ADDED", entityType: "group_quote", entityId: quote.id, newValue: { unitId: row.unit.id, propertyId: row.property.id, totalMinor: input.totalMinor, depositMinor: input.depositMinor } });
  });
  revalidatePath("/staff/quotations");
}

export async function sendGroupQuote(formData: FormData): Promise<void> {
  const input = z.object({ quoteId: z.string().uuid(), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:quotes:approve");
  const [quote] = await getDb().select({ quote: groupQuotes, enquiry: groupEnquiries }).from(groupQuotes).innerJoin(groupEnquiries, eq(groupEnquiries.id, groupQuotes.enquiryId)).where(eq(groupQuotes.id, input.quoteId)).limit(1);
  if (!quote || quote.quote.status !== "DRAFT" || quote.quote.expiresAt <= new Date()) throw new Error("Quote is not ready to send");
  const [optionCount] = await getDb().select({ value: sql<number>`count(*)::int` }).from(groupQuoteOptions).where(eq(groupQuoteOptions.quoteId, quote.quote.id));
  if (!optionCount || optionCount.value < 1) throw new Error("Add at least one option before sending the quote");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const acceptanceUrl = new URL(`/group-quotes/${quote.quote.reference}?token=${encodeURIComponent(token)}`, getEnv().NEXT_PUBLIC_APP_URL).toString();
  await getDb().transaction(async (tx) => {
    await tx.update(groupQuotes).set({ status: "SENT", acceptanceTokenHash: tokenHash, updatedAt: new Date() }).where(eq(groupQuotes.id, quote.quote.id));
    await tx.update(groupEnquiries).set({ status: "QUOTE_SENT", updatedAt: new Date() }).where(eq(groupEnquiries.id, quote.enquiry.id));
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "GROUP_QUOTE_SENT", aggregateType: "group_quote", aggregateId: quote.quote.id, payload: { quoteId: quote.quote.id, enquiryId: quote.enquiry.id, acceptanceUrl, contact: quote.enquiry.contact } });
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "GROUP_QUOTE_SENT", entityType: "group_quote", entityId: quote.quote.id, oldValue: { status: quote.quote.status }, newValue: { status: "SENT", expiresAt: quote.quote.expiresAt }, reason: input.reason });
  });
  revalidatePath("/staff/quotations");
}

export async function recordOfflinePayment(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), amountMinor: z.coerce.number().int().min(1).max(1_000_000_000), method: z.enum(["BANK_TRANSFER", "MANUAL_MPESA", "OFFLINE"]), externalReference: z.string().trim().min(4).max(120) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:payments:record");
  await requireRecentReverification("strict_mfa");
  const [row] = await getDb().select({ booking: bookings, quote: pricingSnapshots }).from(bookings).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id)).where(eq(bookings.id, input.bookingId)).limit(1);
  const payingConfirmedBalance = row?.booking.status === "CONFIRMED" && inArrayValue(row.booking.paymentStatus, ["PARTIALLY_PAID", "PROCESSING"]);
  if (!row || (!payingConfirmedBalance && !inArrayValue(row.booking.status, ["AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED"]))) throw new Error("Booking is not awaiting payment");
  const [paid] = await getDb().select({ total: sql<bigint>`coalesce(sum(${payments.amountMinor}) filter (where ${payments.status} = 'SUCCEEDED'), 0)::bigint` }).from(payments).where(eq(payments.bookingId, row.booking.id));
  const paidBefore = BigInt(paid?.total ?? 0n);
  const amountMinor = BigInt(input.amountMinor);
  const newPaid = paidBefore + amountMinor;
  const fullyPaid = newPaid >= row.quote.guestTotalMinor;
  const schedules = await getDb().select().from(bookingPaymentSchedules).where(eq(bookingPaymentSchedules.bookingId, row.booking.id)).orderBy(bookingPaymentSchedules.sequence);
  let scheduledCumulative = 0n;
  const coveredScheduleIds: string[] = [];
  for (const schedule of schedules) {
    scheduledCumulative += schedule.amountMinor;
    if (newPaid >= scheduledCumulative) coveredScheduleIds.push(schedule.id);
  }
  const confirmationThreshold = schedules[0]?.amountMinor ?? row.quote.guestTotalMinor;
  const shouldConfirm = row.booking.status !== "CONFIRMED" && newPaid >= confirmationThreshold;
  const paymentReference = `MAN-${row.booking.reference}-${input.externalReference}`;
  const eventId = `manual-${input.externalReference}`;
  const payment = await getDb().transaction(async (tx) => {
    const [saved] = await tx.insert(payments).values({ reference: paymentReference, bookingId: row.booking.id, provider: "MANUAL", providerTransactionId: input.externalReference, amountMinor, currency: "KES", method: input.method, status: "SUCCEEDED", paidAt: new Date(), verifiedAt: new Date(), reconciliationStatus: "RECONCILED" }).returning();
    if (coveredScheduleIds.length > 0) await tx.update(bookingPaymentSchedules).set({ status: "PAID", paymentId: saved.id, updatedAt: new Date() }).where(and(inArray(bookingPaymentSchedules.id, coveredScheduleIds), eq(bookingPaymentSchedules.status, "PENDING")));
    await tx.update(bookings).set({ status: shouldConfirm ? "PAYMENT_PROCESSING" : row.booking.status, paymentStatus: fullyPaid ? "SUCCEEDED" : "PARTIALLY_PAID", updatedAt: new Date() }).where(eq(bookings.id, row.booking.id));
    const [journal] = await tx.insert(ledgerJournals).values({ reference: `MANUAL-${input.externalReference}`, eventType: "OFFLINE_PAYMENT", bookingId: row.booking.id, paymentId: saved.id, description: `Staff-recorded ${input.method}` }).returning({ id: ledgerJournals.id });
    const outstandingBefore = row.quote.guestTotalMinor > paidBefore ? row.quote.guestTotalMinor - paidBefore : 0n;
    const bookingCredit = amountMinor < outstandingBefore ? amountMinor : outstandingBefore;
    const guestCredit = amountMinor - bookingCredit;
    await tx.insert(ledgerEntries).values({ journalId: journal.id, accountCode: "OFFLINE_CLEARING", debitMinor: amountMinor, creditMinor: 0n });
    if (bookingCredit > 0n) await tx.insert(ledgerEntries).values({ journalId: journal.id, accountCode: "GUEST_BOOKING_LIABILITY", debitMinor: 0n, creditMinor: bookingCredit });
    if (guestCredit > 0n) await tx.insert(ledgerEntries).values({ journalId: journal.id, accountCode: "GUEST_CREDIT", debitMinor: 0n, creditMinor: guestCredit });
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "OFFLINE_PAYMENT_RECORDED", entityType: "payment", entityId: saved.id, newValue: { amountMinor: input.amountMinor, method: input.method, externalReference: input.externalReference }, reason: "Staff verified offline funds" });
    if (row.booking.status === "CONFIRMED") await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: fullyPaid ? "BOOKING_BALANCE_PAID" : "BOOKING_PART_PAYMENT_RECEIVED", aggregateType: "booking", aggregateId: row.booking.id, payload: { bookingId: row.booking.id, paymentId: saved.id } });
    return saved;
  });
  if (shouldConfirm) await confirmPaidBooking({ bookingId: row.booking.id, paymentId: payment.id, providerEventId: eventId });
  revalidatePath("/staff/payments"); revalidatePath("/staff/bookings");
}

export async function reconcilePayment(formData: FormData): Promise<void> {
  const input = z.object({ paymentId: z.string().uuid(), status: z.enum(["RECONCILED", "EXCEPTION"]), reason: z.string().trim().min(5).max(500) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:payments:record");
  const [payment] = await getDb().select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
  if (!payment) throw new Error("Payment was not found");
  await getDb().transaction(async (tx) => {
    await tx.update(payments).set({ reconciliationStatus: input.status, updatedAt: new Date() }).where(eq(payments.id, input.paymentId));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "PAYMENT_RECONCILED", entityType: "payment", entityId: input.paymentId, oldValue: { reconciliationStatus: payment.reconciliationStatus }, newValue: { reconciliationStatus: input.status }, reason: input.reason });
  });
  revalidatePath("/staff/payments");
}

export async function decideRefund(formData: FormData): Promise<void> {
  const input = z.object({ refundId: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:refunds:approve");
  await requireRecentReverification("strict_mfa");
  const [refund] = await getDb().select().from(refunds).where(eq(refunds.id, input.refundId)).limit(1);
  if (!refund || refund.status !== "PENDING") throw new Error("Refund is not awaiting approval");
  await getDb().transaction(async (tx) => {
    await tx.update(refunds).set({ status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", approvedBy: context.user.id, overrideReason: input.reason, updatedAt: new Date() }).where(eq(refunds.id, refund.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: input.decision === "APPROVE" ? "REFUND_APPROVED" : "REFUND_REJECTED", entityType: "refund", entityId: refund.id, oldValue: { status: refund.status }, newValue: { status: input.decision }, reason: input.reason });
    if (input.decision === "APPROVE") await tx.insert(outboxEvents).values({ queueName: "payments", eventType: "REFUND_APPROVED", aggregateType: "refund", aggregateId: refund.id, payload: { refundId: refund.id } });
  });
  revalidatePath("/staff/refunds");
}

export async function approvePayout(formData: FormData): Promise<void> {
  const input = z.object({ payoutId: z.string().uuid(), decision: z.enum(["APPROVE", "HOLD", "MARK_PAID"]), reason: z.string().trim().min(5).max(1000), externalReference: z.string().trim().max(120).optional() }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:payouts:approve");
  await requireRecentReverification("strict_mfa");
  const [payout] = await getDb().select().from(payouts).where(eq(payouts.id, input.payoutId)).limit(1);
  if (!payout) throw new Error("Payout was not found");
  const status = input.decision === "APPROVE" ? "APPROVED" as const : input.decision === "HOLD" ? "ON_HOLD" as const : "PAID" as const;
  if (status === "PAID" && !input.externalReference) throw new Error("A bank or M-Pesa reference is required when marking a payout paid");
  const allowed = status === "APPROVED"
    ? ["PENDING", "ON_HOLD"]
    : status === "ON_HOLD"
      ? ["PENDING", "APPROVED", "PROCESSING"]
      : ["APPROVED", "PROCESSING"];
  if (!allowed.includes(payout.status)) throw new Error(`Payout cannot transition from ${payout.status} to ${status}`);
  await getDb().transaction(async (tx) => {
    await tx.update(payouts).set({ status, approvedBy: status === "APPROVED" ? context.user.id : payout.approvedBy, processedBy: status === "PAID" ? context.user.id : payout.processedBy, externalReference: input.externalReference || payout.externalReference, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: `PAYOUT_${status}`, entityType: "payout", entityId: payout.id, oldValue: { status: payout.status }, newValue: { status, externalReference: input.externalReference }, reason: input.reason });
    if (status === "PAID") await tx.insert(outboxEvents).values({ deduplicationKey: `payout-paid-${payout.id}`, queueName: "notifications", eventType: "PAYOUT_COMPLETED", aggregateType: "payout", aggregateId: payout.id, payload: { payoutId: payout.id, reference: payout.reference } }).onConflictDoNothing();
  });
  revalidatePath("/staff/payouts");
}

export async function resolveDispute(formData: FormData): Promise<void> {
  const input = z.object({ disputeId: z.string().uuid(), resolution: z.string().trim().min(10).max(3000), outcome: z.enum(["RESOLVED_GUEST", "RESOLVED_HOST", "CLOSED_NO_ACTION"]) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:support:manage");
  const [dispute] = await getDb().select().from(disputes).where(eq(disputes.id, input.disputeId)).limit(1);
  if (!dispute || dispute.status === "CLOSED") throw new Error("Dispute is not open");
  await getDb().transaction(async (tx) => {
    await tx.update(disputes).set({ status: "CLOSED", resolution: `${input.outcome}: ${input.resolution}`, resolvedBy: context.user.id, resolvedAt: new Date(), updatedAt: new Date() }).where(eq(disputes.id, dispute.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "DISPUTE_RESOLVED", entityType: "dispute", entityId: dispute.id, oldValue: { status: dispute.status }, newValue: { status: "CLOSED", outcome: input.outcome }, reason: input.resolution });
  });
  revalidatePath("/staff/disputes");
}

export async function createStaffManualBooking(formData: FormData): Promise<void> {
  const input = z.object({ guestUserId: z.string().uuid(), unitId: z.string().uuid(), checkIn: z.string().date(), checkOut: z.string().date(), adults: z.coerce.number().int().min(1).max(100), children: z.coerce.number().int().min(0).max(100), rooms: z.coerce.number().int().min(1).max(100), guestRequirements: z.string().trim().max(2000).default("") }).refine((value) => value.checkOut > value.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:bookings:manage");
  const [guest] = await getDb().select({ id: users.id, status: users.status }).from(users).where(eq(users.id, input.guestUserId)).limit(1);
  if (!guest || guest.status !== "ACTIVE") throw new Error("Select an active guest account");
  const booking = await createBooking(guest.id, { unitId: input.unitId, checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, children: input.children, rooms: input.rooms, mealFeeMinor: 0, servicesMinor: 0, guestRequirements: input.guestRequirements, idempotencyKey: `staff-${crypto.randomUUID()}` });
  await getDb().transaction(async (tx) => {
    await tx.update(bookings).set({ source: "STAFF", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "MANUAL_BOOKING_CREATED", entityType: "booking", entityId: booking.id, newValue: { guestUserId: guest.id, unitId: input.unitId, dates: [input.checkIn, input.checkOut], rooms: input.rooms } });
  });
  revalidatePath("/staff/manual-bookings"); revalidatePath("/staff/bookings");
}

export async function createRefundRequest(formData: FormData): Promise<void> {
  const input = z.object({ paymentId: z.string().uuid(), refundableAccommodationPercent: z.coerce.number().min(0).max(100), serviceFeeRefundable: z.string().optional(), providerChargesMinor: z.coerce.number().int().min(0).max(100_000_000), guestPenaltyMinor: z.coerce.number().int().min(0).max(100_000_000), manualAdjustmentMinor: z.coerce.number().int().min(-100_000_000).max(100_000_000), reason: z.string().trim().min(10).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:refunds:request");
  const [row] = await getDb().select({ payment: payments, booking: bookings, snapshotId: pricingSnapshots.id }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id)).where(eq(payments.id, input.paymentId)).limit(1);
  if (!row || !inArrayValue(row.payment.status, ["SUCCEEDED", "PARTIALLY_REFUNDED"])) throw new Error("Only a verified payment can be refunded");
  const [serviceFee] = await getDb().select({ amount: sql<bigint>`coalesce(sum(${bookingPriceItems.amountMinor}), 0)::bigint` }).from(bookingPriceItems).where(and(eq(bookingPriceItems.snapshotId, row.snapshotId), eq(bookingPriceItems.code, "SERVICE_FEE")));
  const serviceFeePaid = serviceFee?.amount && serviceFee.amount < row.payment.amountMinor ? serviceFee.amount : 0n;
  const result = calculateRefund({ accommodationPaidMinor: row.payment.amountMinor - serviceFeePaid, serviceFeePaidMinor: serviceFeePaid, providerChargesMinor: BigInt(input.providerChargesMinor), refundableAccommodationBasisPoints: Math.round(input.refundableAccommodationPercent * 100), serviceFeeRefundable: input.serviceFeeRefundable === "on", guestPenaltyMinor: BigInt(input.guestPenaltyMinor), manualAdjustmentMinor: BigInt(input.manualAdjustmentMinor) });
  if (result.finalRefund.amountMinor <= 0n) throw new Error("The calculated refund is zero; record a no-refund decision in the support case instead");
  const [refund] = await getDb().insert(refunds).values({ paymentId: row.payment.id, amountMinor: result.finalRefund.amountMinor, status: "PENDING", reason: input.reason, overrideReason: input.manualAdjustmentMinor === 0 ? null : `Manual adjustment ${input.manualAdjustmentMinor} minor units` }).returning({ id: refunds.id });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "REFUND_REQUEST_CALCULATED", entityType: "refund", entityId: refund.id, newValue: { paymentId: row.payment.id, calculation: { refundableAccommodationMinor: result.refundableAccommodation.amountMinor.toString(), refundableServiceFeeMinor: result.refundableServiceFee.amountMinor.toString(), providerChargesMinor: result.providerChargesRetained.amountMinor.toString(), guestPenaltyMinor: result.guestPenalty.amountMinor.toString(), manualAdjustmentMinor: result.manualAdjustmentMinor.toString(), finalRefundMinor: result.finalRefund.amountMinor.toString() } }, reason: input.reason });
  revalidatePath("/staff/refunds");
}

export async function reviewHostDocument(formData: FormData): Promise<void> {
  const input = z.object({ documentId: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT", "REQUEST_REUPLOAD"]), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:hosts:verify");
  const [document] = await getDb().select().from(hostDocuments).where(eq(hostDocuments.id, input.documentId)).limit(1);
  if (!document || !inArrayValue(document.status, ["PENDING", "REUPLOAD_REQUESTED"])) throw new Error("Document is not awaiting review");
  const status = input.decision === "APPROVE" ? "APPROVED" as const : input.decision === "REJECT" ? "REJECTED" as const : "REUPLOAD_REQUESTED" as const;
  await getDb().transaction(async (tx) => {
    await tx.update(hostDocuments).set({ status, rejectionReason: status === "APPROVED" ? null : input.reason, reviewedBy: context.user.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(hostDocuments.id, document.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: `HOST_DOCUMENT_${status}`, entityType: "host_document", entityId: document.id, oldValue: { status: document.status }, newValue: { status }, reason: input.reason });
  });
  revalidatePath("/staff/host-onboarding");
}

export async function decideHostOrganization(formData: FormData): Promise<void> {
  const input = z.object({ organizationId: z.string().uuid(), decision: z.enum(["VERIFY", "SUSPEND", "REJECT"]), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:hosts:verify");
  const [organization] = await getDb().select().from(hostOrganizations).where(eq(hostOrganizations.id, input.organizationId)).limit(1);
  if (!organization) throw new Error("Host organisation was not found");
  if (input.decision === "VERIFY") {
    const [approvedDocuments] = await getDb().select({ count: sql<number>`count(*)::int` }).from(hostDocuments).innerJoin(hostProfiles, eq(hostProfiles.id, hostDocuments.hostId)).where(and(eq(hostProfiles.hostOrganizationId, organization.id), eq(hostDocuments.status, "APPROVED")));
    if (!approvedDocuments || approvedDocuments.count < 1) throw new Error("Approve at least one host verification document first");
  }
  const status = input.decision === "VERIFY" ? "VERIFIED" : input.decision === "SUSPEND" ? "SUSPENDED" : "REJECTED";
  await getDb().transaction(async (tx) => {
    await tx.update(hostOrganizations).set({ status, verifiedAt: status === "VERIFIED" ? new Date() : organization.verifiedAt, updatedAt: new Date(), version: organization.version + 1 }).where(and(eq(hostOrganizations.id, organization.id), eq(hostOrganizations.version, organization.version)));
    if (status === "SUSPENDED" || status === "REJECTED") await tx.update(properties).set({ status: "SUSPENDED", updatedAt: new Date() }).where(eq(properties.hostOrganizationId, organization.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: `HOST_ORGANIZATION_${status}`, entityType: "host_organization", entityId: organization.id, oldValue: { status: organization.status }, newValue: { status }, reason: input.reason });
  });
  revalidatePath("/staff/host-onboarding");
}

export async function decidePayoutAccount(formData: FormData): Promise<void> {
  const input = z.object({ accountId: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(10).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:payouts:approve");
  await requireRecentReverification("strict_mfa");
  const [account] = await getDb().select().from(payoutAccounts).where(eq(payoutAccounts.id, input.accountId)).limit(1);
  if (!account || account.status !== "PENDING_APPROVAL") throw new Error("Payout account is not awaiting approval");
  await getDb().transaction(async (tx) => {
    if (input.decision === "APPROVE") await tx.update(payoutAccounts).set({ status: "SUPERSEDED", updatedAt: new Date() }).where(and(eq(payoutAccounts.hostOrganizationId, account.hostOrganizationId), eq(payoutAccounts.status, "APPROVED")));
    await tx.update(payoutAccounts).set({ status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", approvedBy: context.user.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(payoutAccounts.id, account.id));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: `PAYOUT_ACCOUNT_${input.decision}D`, entityType: "payout_account", entityId: account.id, oldValue: { status: account.status }, newValue: { status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED" }, reason: input.reason });
  });
  revalidatePath("/staff/payouts");
}

export async function updateSupportTicket(formData: FormData): Promise<void> {
  const input = z.object({ ticketId: z.string().uuid(), status: z.enum(["IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]), response: z.string().trim().min(5).max(4000), internal: z.string().optional() }).parse(Object.fromEntries(formData));
  const context = await requireInternalPermission("internal:support:manage");
  const [ticket] = await getDb().select().from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1);
  if (!ticket || ticket.status === "CLOSED") throw new Error("Ticket is no longer actionable");
  await getDb().transaction(async (tx) => {
    await tx.update(supportTickets).set({ status: input.status, assignedTo: ticket.assignedTo ?? context.user.id, resolution: input.status === "RESOLVED" || input.status === "CLOSED" ? input.response : ticket.resolution, updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
    await tx.insert(ticketMessages).values({ ticketId: ticket.id, senderId: context.user.id, body: input.response, internal: input.internal === "on" });
    if (input.internal !== "on") await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "SUPPORT_TICKET_UPDATED", aggregateType: "support_ticket", aggregateId: ticket.id, payload: { ticketId: ticket.id, status: input.status } });
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "SUPPORT_TICKET_UPDATED", entityType: "support_ticket", entityId: ticket.id, oldValue: { status: ticket.status }, newValue: { status: input.status, internalResponse: input.internal === "on" } });
  });
  revalidatePath("/staff/support");
}

function inArrayValue<T extends string>(value: string, values: readonly T[]): value is T { return values.includes(value as T); }
