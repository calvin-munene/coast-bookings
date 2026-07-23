import "server-only";

import { subMinutes } from "date-fns";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/connection";
import {
  bookingStatusHistory,
  bookingPaymentSchedules,
  bookings,
  disputes,
  inventoryHolds,
  internalStaffTasks,
  ledgerEntries,
  ledgerJournals,
  outboxEvents,
  paymentCheckoutSessions,
  paymentEvents,
  payments,
  payouts,
  pricingSnapshots,
  webhookEvents,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { confirmPaidBooking } from "@/modules/bookings/confirmation-service";
import { WhopPaymentProvider } from "./providers/whop";

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  company_id: z.string().optional(),
  data: z.object({
    id: z.string().min(1),
    checkout_configuration_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    substatus: z.string().optional(),
    payment_method_type: z.string().nullable().optional(),
    payment_id: z.string().optional(),
    refunded_amount: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).passthrough(),
}).passthrough();

export type WhopWebhookResult = Readonly<{ duplicate: boolean; eventId: string; type: string; paymentStateChanged: boolean; reviewRequired: boolean }>;

async function markProcessed(eventId: string, status = "PROCESSED"): Promise<void> {
  await getDb().update(webhookEvents).set({ status, processedAt: new Date() }).where(and(eq(webhookEvents.provider, "WHOP"), eq(webhookEvents.providerEventId, eventId)));
}

async function createReviewTask(bookingId: string, title: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) return;
    if (booking.status !== "PAYMENT_REVIEW") {
      await tx.update(bookings).set({ status: "PAYMENT_REVIEW", paymentStatus: "PROCESSING", updatedAt: new Date() }).where(eq(bookings.id, bookingId));
      await tx.insert(bookingStatusHistory).values({ bookingId, fromStatus: booking.status, toStatus: "PAYMENT_REVIEW", reason: title });
    }
    await tx.insert(internalStaffTasks).values({ entityType: "booking", entityId: bookingId, title, priority: "URGENT", status: "OPEN" });
    await tx.insert(outboxEvents).values({ queueName: "operations", eventType: "PAYMENT_REVIEW_REQUIRED", aggregateType: "booking", aggregateId: bookingId, payload: { bookingId, reason: title } });
  });
}

export async function processWhopWebhook(rawBody: string, headers: Headers): Promise<WhopWebhookResult> {
  const provider = new WhopPaymentProvider();
  const parsed = await provider.parseWebhook(rawBody, headers);
  const event = eventSchema.parse(parsed.rawPayload);
  const inserted = await getDb().insert(webhookEvents).values({ provider: "WHOP", providerEventId: parsed.providerEventId, payloadHash: parsed.payloadHash, status: "PROCESSING" }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    const [existing] = await getDb().select().from(webhookEvents).where(and(eq(webhookEvents.provider, "WHOP"), eq(webhookEvents.providerEventId, parsed.providerEventId))).limit(1);
    if (!existing || existing.payloadHash !== parsed.payloadHash) throw new Error("Webhook event ID was reused with a different payload");
    const terminal = ["PROCESSED", "UNMATCHED", "REJECTED_COMPANY"].includes(existing.status);
    if (terminal) return { duplicate: true, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: false, reviewRequired: existing.status === "UNMATCHED" };
    const [claimed] = await getDb().update(webhookEvents).set({ status: "PROCESSING", receivedAt: new Date() })
      .where(and(
        eq(webhookEvents.id, existing.id),
        or(eq(webhookEvents.status, "RECEIVED"), and(eq(webhookEvents.status, "PROCESSING"), lte(webhookEvents.receivedAt, subMinutes(new Date(), 5)))),
      )).returning({ id: webhookEvents.id });
    if (!claimed) return { duplicate: true, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: false, reviewRequired: false };
  }

  if (event.company_id && event.company_id !== getEnv().WHOP_COMPANY_ID) {
    await markProcessed(parsed.providerEventId, "REJECTED_COMPANY");
    throw new Error("Whop event belongs to a different company");
  }

  const metadataPaymentId = typeof event.data.metadata?.payment_id === "string" ? event.data.metadata.payment_id : undefined;
  const metadataBookingId = typeof event.data.metadata?.booking_id === "string" ? event.data.metadata.booking_id : undefined;
  const [record] = metadataPaymentId
    ? await getDb().select({ payment: payments, booking: bookings, hold: inventoryHolds, session: paymentCheckoutSessions })
      .from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).leftJoin(inventoryHolds, eq(inventoryHolds.id, bookings.holdId)).innerJoin(paymentCheckoutSessions, eq(paymentCheckoutSessions.paymentId, payments.id)).where(eq(payments.id, metadataPaymentId)).limit(1)
    : event.data.checkout_configuration_id
      ? await getDb().select({ payment: payments, booking: bookings, hold: inventoryHolds, session: paymentCheckoutSessions })
        .from(paymentCheckoutSessions).innerJoin(payments, eq(payments.id, paymentCheckoutSessions.paymentId)).innerJoin(bookings, eq(bookings.id, payments.bookingId)).leftJoin(inventoryHolds, eq(inventoryHolds.id, bookings.holdId)).where(eq(paymentCheckoutSessions.providerSessionId, event.data.checkout_configuration_id)).limit(1)
      : [];

  if (!record) {
    await markProcessed(parsed.providerEventId, "UNMATCHED");
    return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: false, reviewRequired: true };
  }

  await getDb().insert(paymentEvents).values({ paymentId: record.payment.id, provider: "WHOP", providerEventId: parsed.providerEventId, payloadHash: parsed.payloadHash, payload: event }).onConflictDoNothing();

  if (event.type === "payment.succeeded") {
    if (record.payment.providerTransactionId === event.data.id && inArrayValue(record.payment.status, ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"])) {
      await markProcessed(parsed.providerEventId);
      return { duplicate: true, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: false, reviewRequired: false };
    }
    const verification = await provider.verifyPayment(event.data.id);
    const amountMatches = verification.paidAmount.amountMinor === record.payment.amountMinor.toString();
    const metadataMatches = (!metadataPaymentId || metadataPaymentId === record.payment.id) && (!metadataBookingId || metadataBookingId === record.booking.id);
    const sessionMatches = !event.data.checkout_configuration_id || event.data.checkout_configuration_id === record.session.providerSessionId;
    const holdValid = record.booking.status === "CONFIRMED" || Boolean(record.hold && record.hold.status === "ACTIVE" && record.hold.expiresAt > new Date());
    const reviewRequired = !amountMatches || !metadataMatches || !sessionMatches || !holdValid;
    await getDb().transaction(async (tx) => {
      await tx.update(payments).set({
        status: "SUCCEEDED",
        providerTransactionId: event.data.id,
        method: event.data.payment_method_type ?? "WHOP_CHECKOUT",
        paidAt: verification.paidAt ? new Date(verification.paidAt) : new Date(),
        verifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(payments.id, record.payment.id));
      await tx.update(paymentCheckoutSessions).set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() }).where(eq(paymentCheckoutSessions.id, record.session.id));
      await tx.update(bookingPaymentSchedules).set({ status: "PAID", updatedAt: new Date() }).where(eq(bookingPaymentSchedules.paymentId, record.payment.id));
      const [journal] = await tx.insert(ledgerJournals).values({ reference: `WHOP-${parsed.providerEventId}`, eventType: "PAYMENT_SUCCEEDED", bookingId: record.booking.id, paymentId: record.payment.id, description: `Whop payment for ${record.booking.reference}` }).onConflictDoNothing().returning({ id: ledgerJournals.id });
      if (journal) await tx.insert(ledgerEntries).values([
        { journalId: journal.id, accountCode: "WHOP_CLEARING", debitMinor: record.payment.amountMinor, creditMinor: 0n, currency: "KES" },
        { journalId: journal.id, accountCode: "GUEST_BOOKING_LIABILITY", debitMinor: 0n, creditMinor: record.payment.amountMinor, currency: "KES" },
      ]);
    });
    const [totals] = await getDb().select({ paid: sql<bigint>`coalesce(sum(${payments.amountMinor}) filter (where ${payments.status} = 'SUCCEEDED'), 0)::bigint`, due: pricingSnapshots.guestTotalMinor })
      .from(payments).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, payments.bookingId)).where(eq(payments.bookingId, record.booking.id)).groupBy(pricingSnapshots.guestTotalMinor);
    const fullyPaid = Boolean(totals && totals.paid >= totals.due);
    if (reviewRequired) {
      const reasons = [!amountMatches && "amount mismatch", !metadataMatches && "metadata mismatch", !sessionMatches && "checkout mismatch", !holdValid && "expired inventory hold"].filter(Boolean).join(", ");
      await createReviewTask(record.booking.id, `Whop payment requires review: ${reasons}`);
    } else if (record.booking.status === "CONFIRMED") {
      await getDb().update(bookings).set({ paymentStatus: fullyPaid ? "SUCCEEDED" : "PARTIALLY_PAID", updatedAt: new Date() }).where(eq(bookings.id, record.booking.id));
      await getDb().insert(outboxEvents).values({ queueName: "notifications", eventType: fullyPaid ? "BOOKING_BALANCE_PAID" : "BOOKING_PART_PAYMENT_RECEIVED", aggregateType: "booking", aggregateId: record.booking.id, payload: { bookingId: record.booking.id, paymentId: record.payment.id } });
    } else {
      try {
        await confirmPaidBooking({ bookingId: record.booking.id, paymentId: record.payment.id, providerEventId: parsed.providerEventId });
      } catch (error) {
        await createReviewTask(record.booking.id, `Paid booking could not allocate inventory: ${error instanceof Error ? error.message : "unknown database error"}`);
        await markProcessed(parsed.providerEventId);
        return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: true, reviewRequired: true };
      }
    }
    await markProcessed(parsed.providerEventId);
    return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: true, reviewRequired };
  }

  if (event.type === "payment.failed" || event.type === "payment.pending") {
    const failed = event.type === "payment.failed";
    await getDb().transaction(async (tx) => {
      if (!inArrayValue(record.payment.status, ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"])) await tx.update(payments).set({ status: failed ? "FAILED" : "PROCESSING", providerTransactionId: event.data.id, updatedAt: new Date() }).where(eq(payments.id, record.payment.id));
      if (failed && record.booking.status === "PAYMENT_PROCESSING") {
        await tx.update(bookings).set({ status: "PAYMENT_FAILED", paymentStatus: "FAILED", updatedAt: new Date() }).where(eq(bookings.id, record.booking.id));
        await tx.insert(bookingStatusHistory).values({ bookingId: record.booking.id, fromStatus: "PAYMENT_PROCESSING", toStatus: "PAYMENT_FAILED", reason: "Whop reported payment failure" });
      }
    });
    await markProcessed(parsed.providerEventId);
    return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: true, reviewRequired: false };
  }

  if (event.type.startsWith("refund.")) {
    const fullyRefunded = event.data.status === "succeeded" && event.data.refunded_amount !== null && Math.round((event.data.refunded_amount ?? 0) * 100) >= Number(record.payment.amountMinor);
    await getDb().transaction(async (tx) => {
      await tx.update(payments).set({ status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED", updatedAt: new Date() }).where(eq(payments.id, record.payment.id));
      await tx.update(bookings).set({ status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED", paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED", updatedAt: new Date() }).where(eq(bookings.id, record.booking.id));
    });
    await markProcessed(parsed.providerEventId);
    return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: true, reviewRequired: false };
  }

  if (event.type.startsWith("dispute.")) {
    await getDb().transaction(async (tx) => {
      await tx.update(payments).set({ status: "DISPUTED", updatedAt: new Date() }).where(eq(payments.id, record.payment.id));
      if (!inArrayValue(record.booking.status, ["REFUNDED", "CANCELLED_BY_ADMIN"])) await tx.update(bookings).set({ status: "DISPUTED", paymentStatus: "DISPUTED", updatedAt: new Date() }).where(eq(bookings.id, record.booking.id));
      await tx.update(payouts).set({ status: "ON_HOLD", updatedAt: new Date() }).where(and(eq(payouts.bookingId, record.booking.id), inArray(payouts.status, ["NOT_ELIGIBLE", "PENDING", "APPROVED", "PROCESSING"])));
      await tx.insert(disputes).values({ reference: `DSP-${event.data.id}`, bookingId: record.booking.id, openedBy: record.booking.guestUserId, category: "WHOP_CHARGEBACK", summary: "Whop reported a payment dispute", status: "OPEN" }).onConflictDoNothing();
      await tx.insert(internalStaffTasks).values({ entityType: "booking", entityId: record.booking.id, title: "Respond to Whop payment dispute", priority: "URGENT" });
    });
    await markProcessed(parsed.providerEventId);
    return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: true, reviewRequired: true };
  }

  await markProcessed(parsed.providerEventId);
  return { duplicate: false, eventId: parsed.providerEventId, type: event.type, paymentStateChanged: false, reviewRequired: false };
}

function inArrayValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}
