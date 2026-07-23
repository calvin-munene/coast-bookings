import "server-only";

import { addHours, addMinutes, subDays, subHours } from "date-fns";
import { and, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/connection";
import {
  bookingPaymentSchedules,
  bookingStatusHistory,
  bookings,
  conversationMembers,
  disputes,
  groupEnquiries,
  groupQuoteOptions,
  groupQuotes,
  internalStaffTasks,
  inventoryHolds,
  ledgerEntries,
  ledgerJournals,
  messages,
  organizationMemberships,
  outboxEvents,
  payments,
  payoutAccounts,
  payouts,
  pricingSnapshots,
  properties,
  refunds,
  supportTickets,
  users,
} from "@/db/schema";
import { sendEmail } from "@/modules/notifications/providers";
import { deliverTransactionalNotification, findRecipient, type NotificationRecipient } from "@/modules/notifications/service";
import { WhopPaymentProvider } from "@/modules/payments/providers/whop";

type OutboxEvent = typeof outboxEvents.$inferSelect;

function uniqueRecipients(values: readonly (NotificationRecipient | null)[]): NotificationRecipient[] {
  return [...new Map(values.filter((value): value is NotificationRecipient => value !== null).map((value) => [value.userId, value])).values()];
}

async function recipientsForEvent(event: OutboxEvent): Promise<NotificationRecipient[]> {
  const payloadUserId = typeof event.payload.userId === "string" ? event.payload.userId : null;
  if (payloadUserId) return uniqueRecipients([await findRecipient(payloadUserId)]);
  if (event.aggregateType === "booking") {
    const [booking] = await getDb().select({ guestUserId: bookings.guestUserId, organizationId: bookings.hostOrganizationId }).from(bookings).where(eq(bookings.id, event.aggregateId)).limit(1);
    if (!booking) return [];
    const members = await getDb().select({ userId: users.id, name: users.fullName, email: users.primaryEmail, phone: users.phone })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(and(eq(organizationMemberships.organizationId, booking.organizationId), eq(organizationMemberships.status, "ACTIVE"), eq(users.status, "ACTIVE")));
    return uniqueRecipients([await findRecipient(booking.guestUserId), ...members]);
  }
  if (event.aggregateType === "property") {
    const [property] = await getDb().select({ organizationId: properties.hostOrganizationId }).from(properties).where(eq(properties.id, event.aggregateId)).limit(1);
    if (!property) return [];
    return getDb().select({ userId: users.id, name: users.fullName, email: users.primaryEmail, phone: users.phone })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(and(eq(organizationMemberships.organizationId, property.organizationId), eq(organizationMemberships.status, "ACTIVE"), eq(users.status, "ACTIVE")));
  }
  if (event.aggregateType === "support_ticket") {
    const [ticket] = await getDb().select({ userId: supportTickets.userId }).from(supportTickets).where(eq(supportTickets.id, event.aggregateId)).limit(1);
    return ticket ? uniqueRecipients([await findRecipient(ticket.userId)]) : [];
  }
  if (event.aggregateType === "message") {
    const memberRows = await getDb().select({ userId: users.id, name: users.fullName, email: users.primaryEmail, phone: users.phone })
      .from(messages).innerJoin(conversationMembers, eq(conversationMembers.conversationId, messages.conversationId)).innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(and(eq(messages.id, event.aggregateId), eq(users.status, "ACTIVE")));
    return uniqueRecipients(memberRows);
  }
  if (event.aggregateType === "payout") {
    const [payout] = await getDb().select({ organizationId: payouts.hostOrganizationId }).from(payouts).where(eq(payouts.id, event.aggregateId)).limit(1);
    if (!payout) return [];
    return getDb().select({ userId: users.id, name: users.fullName, email: users.primaryEmail, phone: users.phone })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(and(eq(organizationMemberships.organizationId, payout.organizationId), eq(organizationMemberships.status, "ACTIVE"), eq(users.status, "ACTIVE")));
  }
  if (event.aggregateType === "group_enquiry" || event.aggregateType === "group_quote") {
    const [enquiry] = event.aggregateType === "group_enquiry"
      ? await getDb().select({ coordinatorId: groupEnquiries.coordinatorId }).from(groupEnquiries).where(eq(groupEnquiries.id, event.aggregateId)).limit(1)
      : await getDb().select({ coordinatorId: groupEnquiries.coordinatorId }).from(groupQuotes).innerJoin(groupEnquiries, eq(groupEnquiries.id, groupQuotes.enquiryId)).where(eq(groupQuotes.id, event.aggregateId)).limit(1);
    return enquiry?.coordinatorId ? uniqueRecipients([await findRecipient(enquiry.coordinatorId)]) : [];
  }
  return [];
}

const quoteEmailPayloadSchema = z.object({
  acceptanceUrl: z.string().url(),
  contact: z.object({ name: z.string().min(1), email: z.string().email() }),
}).passthrough();

async function deliverNotificationEvent(event: OutboxEvent): Promise<void> {
  if (event.eventType === "GROUP_QUOTE_SENT") {
    const payload = quoteEmailPayloadSchema.parse(event.payload);
    await sendEmail({
      to: payload.contact.email,
      recipientName: payload.contact.name,
      subject: "Your Coast Bookings group quotation is ready",
      text: "Your private comparison quotation is ready. Sign in with this email address to review the held options and accept one before it expires.",
      actionUrl: payload.acceptanceUrl,
      idempotencyKey: `group-quote-${event.id}`,
    });
    return;
  }
  const recipients = await recipientsForEvent(event);
  if (recipients.length === 0) return;
  await deliverTransactionalNotification(event.id, event.eventType, event.payload, recipients);
}

async function processRefundEvent(event: OutboxEvent): Promise<void> {
  if (event.eventType !== "REFUND_APPROVED") return;
  const [row] = await getDb().select({ refund: refunds, payment: payments, booking: bookings })
    .from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId)).innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(eq(refunds.id, event.aggregateId)).limit(1);
  if (!row || !["APPROVED", "PROCESSING"].includes(row.refund.status)) return;
  if (row.payment.provider !== "WHOP") {
    await getDb().transaction(async (tx) => {
      await tx.update(refunds).set({ status: "MANUAL_PROCESSING", updatedAt: new Date() }).where(eq(refunds.id, row.refund.id));
      await tx.insert(internalStaffTasks).values({ entityType: "refund", entityId: row.refund.id, title: "Process approved manual refund", priority: "HIGH", status: "OPEN" });
    });
    return;
  }
  if (!row.payment.providerTransactionId) throw new Error("Whop payment has no verified provider transaction ID");
  await getDb().update(refunds).set({ status: "PROCESSING", updatedAt: new Date() }).where(eq(refunds.id, row.refund.id));
  const result = await new WhopPaymentProvider().refundPayment({ paymentReference: row.payment.providerTransactionId, amount: { amountMinor: row.refund.amountMinor.toString(), currency: "KES" }, reason: row.refund.reason, idempotencyKey: `refund-${row.refund.id}` });
  if (result.status === "FAILED") throw new Error("Whop rejected the approved refund");
  if (result.status === "PENDING") return;
  const fullyRefundedPayment = row.refund.amountMinor >= row.payment.amountMinor;
  await getDb().transaction(async (tx) => {
    await tx.update(refunds).set({ status: "SUCCEEDED", providerReference: result.providerReference, updatedAt: new Date() }).where(eq(refunds.id, row.refund.id));
    await tx.update(payments).set({ status: fullyRefundedPayment ? "REFUNDED" : "PARTIALLY_REFUNDED", updatedAt: new Date() }).where(eq(payments.id, row.payment.id));
    const [journal] = await tx.insert(ledgerJournals).values({ reference: `REFUND-${row.refund.id}`, eventType: "REFUND_SUCCEEDED", bookingId: row.booking.id, paymentId: row.payment.id, description: `Whop refund for ${row.booking.reference}` }).onConflictDoNothing().returning({ id: ledgerJournals.id });
    if (journal) await tx.insert(ledgerEntries).values([
      { journalId: journal.id, accountCode: "GUEST_BOOKING_LIABILITY", debitMinor: row.refund.amountMinor, creditMinor: 0n },
      { journalId: journal.id, accountCode: "WHOP_CLEARING", debitMinor: 0n, creditMinor: row.refund.amountMinor },
    ]);
    const [paidTotals] = await tx.select({ amount: sql<bigint>`coalesce(sum(${payments.amountMinor}) filter (where ${payments.status} in ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')), 0)::bigint` })
      .from(payments).where(eq(payments.bookingId, row.booking.id));
    const [refundTotals] = await tx.select({ amount: sql<bigint>`coalesce(sum(${refunds.amountMinor}) filter (where ${refunds.status} = 'SUCCEEDED'), 0)::bigint` })
      .from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId)).where(eq(payments.bookingId, row.booking.id));
    const fullyRefundedBooking = Boolean(paidTotals && refundTotals && paidTotals.amount > 0n && refundTotals.amount >= paidTotals.amount);
    await tx.update(bookings).set({ status: fullyRefundedBooking ? "REFUNDED" : "PARTIALLY_REFUNDED", paymentStatus: fullyRefundedBooking ? "REFUNDED" : "PARTIALLY_REFUNDED", updatedAt: new Date() }).where(eq(bookings.id, row.booking.id));
    await tx.update(payouts).set({ status: "ON_HOLD", updatedAt: new Date() }).where(and(eq(payouts.bookingId, row.booking.id), inArray(payouts.status, ["NOT_ELIGIBLE", "PENDING", "APPROVED", "PROCESSING"])));
    await tx.insert(outboxEvents).values({ deduplicationKey: `refund-succeeded-${row.refund.id}`, queueName: "notifications", eventType: "REFUND_PROCESSED", aggregateType: "booking", aggregateId: row.booking.id, payload: { bookingId: row.booking.id, reference: row.booking.reference, refundId: row.refund.id } }).onConflictDoNothing();
  });
}

async function claimOutboxEvents(limit: number): Promise<OutboxEvent[]> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`update outbox_events set status = 'PENDING' where status = 'PROCESSING' and available_at <= now()`);
    const candidates = await tx.execute<{ id: string }>(sql`select id from outbox_events where status = 'PENDING' and available_at <= now() order by created_at limit ${limit} for update skip locked`);
    const ids = candidates.map((row) => row.id);
    if (ids.length === 0) return [];
    await tx.update(outboxEvents).set({ status: "PROCESSING", availableAt: addMinutes(new Date(), 15) }).where(inArray(outboxEvents.id, ids));
    return tx.select().from(outboxEvents).where(inArray(outboxEvents.id, ids));
  });
}

export async function processOutboxBatch(limit = 40): Promise<{ processed: number; retried: number; deadLettered: number }> {
  const events = await claimOutboxEvents(Math.max(1, Math.min(limit, 100)));
  let processed = 0;
  let retried = 0;
  let deadLettered = 0;
  for (const event of events) {
    try {
      if (event.queueName === "notifications") await deliverNotificationEvent(event);
      else if (event.queueName === "payments") await processRefundEvent(event);
      await getDb().update(outboxEvents).set({ status: "PROCESSED", attempts: event.attempts + 1, processedAt: new Date(), lastError: null }).where(eq(outboxEvents.id, event.id));
      processed += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const dead = attempts >= 8;
      await getDb().update(outboxEvents).set({ status: dead ? "DEAD_LETTER" : "PENDING", attempts, availableAt: addMinutes(new Date(), Math.min(2 ** attempts, 60)), lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown job error" }).where(eq(outboxEvents.id, event.id));
      if (dead) deadLettered += 1; else retried += 1;
    }
  }
  return { processed, retried, deadLettered };
}

async function expireInventoryAndQuotes(): Promise<number> {
  const expired = await getDb().select({ id: inventoryHolds.id }).from(inventoryHolds).where(and(eq(inventoryHolds.status, "ACTIVE"), lte(inventoryHolds.expiresAt, new Date()))).limit(200);
  for (const hold of expired) {
    const bookingRows = await getDb().select({ id: bookings.id, status: bookings.status }).from(bookings).where(eq(bookings.holdId, hold.id));
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`select public.release_inventory_hold(${hold.id}::uuid, 'EXPIRED'::text)`);
      for (const booking of bookingRows) {
        if (!inArrayValue(booking.status, ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED"])) continue;
        const next = booking.status === "PENDING_HOST_APPROVAL" ? "HOST_DECLINED" as const : "PAYMENT_FAILED" as const;
        await tx.update(bookings).set({ status: next, paymentStatus: "FAILED", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
        await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, fromStatus: booking.status, toStatus: next, reason: "Inventory hold expired" });
      }
    });
  }
  const expiredQuotes = await getDb().select({ id: groupQuotes.id, enquiryId: groupQuotes.enquiryId }).from(groupQuotes).where(and(eq(groupQuotes.status, "SENT"), lte(groupQuotes.expiresAt, new Date()))).limit(100);
  for (const quote of expiredQuotes) {
    const optionHolds = await getDb().select({ holdId: groupQuoteOptions.holdId }).from(groupQuoteOptions).where(eq(groupQuoteOptions.quoteId, quote.id));
    await getDb().transaction(async (tx) => {
      for (const option of optionHolds) if (option.holdId) await tx.execute(sql`select public.release_inventory_hold(${option.holdId}::uuid, 'GROUP_QUOTE_EXPIRED'::text)`);
      await tx.update(groupQuotes).set({ status: "EXPIRED", updatedAt: new Date() }).where(eq(groupQuotes.id, quote.id));
      await tx.update(groupEnquiries).set({ status: "EXPIRED", updatedAt: new Date() }).where(and(eq(groupEnquiries.id, quote.enquiryId), ne(groupEnquiries.status, "CONVERTED_TO_BOOKING")));
    });
  }
  return expired.length + expiredQuotes.length;
}

async function publishEligibleReviews(): Promise<number> {
  const cutoff = subDays(new Date(), 14);
  const guestResult = await getDb().execute(sql`
    update reviews as review set status = 'PUBLISHED', published_at = now(), updated_at = now()
    from bookings as booking
    where review.booking_id = booking.id and review.status = 'PENDING'
      and (exists (select 1 from host_reviews where host_reviews.booking_id = booking.id)
        or coalesce(booking.checked_out_at, booking.updated_at) <= ${cutoff})
    returning review.id`);
  const hostResult = await getDb().execute(sql`
    update host_reviews as review set status = 'PUBLISHED', published_at = now(), updated_at = now()
    from bookings as booking
    where review.booking_id = booking.id and review.status = 'PENDING'
      and (exists (select 1 from reviews where reviews.booking_id = booking.id)
        or coalesce(booking.checked_out_at, booking.updated_at) <= ${cutoff})
    returning review.id`);
  await getDb().execute(sql`
    insert into property_quality_metrics (property_id, completed_stays, review_count, overall_rating_basis_points, host_cancellation_basis_points, unresolved_safety_incidents, coast_favourite, calculated_at)
    select property.id,
      coalesce(booking_metrics.completed_stays, 0)::int,
      coalesce(review_metrics.review_count, 0)::int,
      coalesce(review_metrics.overall_rating_basis_points, 0)::int,
      coalesce(booking_metrics.host_cancellation_basis_points, 0)::int,
      coalesce(dispute_metrics.unresolved_safety_incidents, 0)::int,
      false,
      now()
    from properties as property
    left join lateral (
      select
        count(*) filter (where booking.status in ('CHECKED_OUT','COMPLETED'))::int as completed_stays,
        coalesce(round(10000.0 * count(*) filter (where booking.status = 'CANCELLED_BY_HOST') / nullif(count(*), 0)), 0)::int as host_cancellation_basis_points
      from bookings as booking where booking.property_id = property.id
    ) as booking_metrics on true
    left join lateral (
      select
        count(*) filter (where review.status = 'PUBLISHED')::int as review_count,
        coalesce(round(avg((review.ratings->>'overall')::numeric) filter (where review.status = 'PUBLISHED') * 100), 0)::int as overall_rating_basis_points
      from reviews as review where review.property_id = property.id
    ) as review_metrics on true
    left join lateral (
      select count(*)::int as unresolved_safety_incidents
      from disputes as dispute
      inner join bookings as booking on booking.id = dispute.booking_id
      where booking.property_id = property.id and dispute.status <> 'CLOSED' and dispute.category ilike '%safety%'
    ) as dispute_metrics on true
    on conflict (property_id) do update set
      completed_stays = excluded.completed_stays,
      review_count = excluded.review_count,
      overall_rating_basis_points = excluded.overall_rating_basis_points,
      host_cancellation_basis_points = excluded.host_cancellation_basis_points,
      unresolved_safety_incidents = excluded.unresolved_safety_incidents,
      calculated_at = excluded.calculated_at`);
  return guestResult.length + hostResult.length;
}

async function createEligiblePayouts(): Promise<number> {
  const cutoff = subHours(new Date(), 24);
  const eligible = await getDb().select({ booking: bookings, hostNet: pricingSnapshots.hostEarningsMinor, accountId: payoutAccounts.id })
    .from(bookings).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id)).innerJoin(payoutAccounts, and(eq(payoutAccounts.hostOrganizationId, bookings.hostOrganizationId), eq(payoutAccounts.status, "APPROVED")))
    .leftJoin(payouts, eq(payouts.bookingId, bookings.id))
    .where(and(isNull(payouts.id), inArray(bookings.status, ["CHECKED_IN", "CHECKED_OUT", "COMPLETED"]), lte(bookings.checkedInAt, cutoff))).limit(100);
  let created = 0;
  for (const row of eligible) {
    const [openDispute] = await getDb().select({ id: disputes.id }).from(disputes).where(and(eq(disputes.bookingId, row.booking.id), ne(disputes.status, "CLOSED"))).limit(1);
    if (openDispute || row.hostNet <= 0n) continue;
    const saved = await getDb().insert(payouts).values({ reference: `PO-${row.booking.reference}`, bookingId: row.booking.id, hostId: row.booking.hostId, hostOrganizationId: row.booking.hostOrganizationId, payoutAccountId: row.accountId, amountMinor: row.hostNet, status: "PENDING", eligibleAt: addHours(row.booking.checkedInAt!, 24) }).onConflictDoNothing().returning({ id: payouts.id });
    if (saved[0]) {
      await getDb().insert(outboxEvents).values({ deduplicationKey: `payout-ready-${saved[0].id}`, queueName: "notifications", eventType: "PAYOUT_READY", aggregateType: "payout", aggregateId: saved[0].id, payload: { payoutId: saved[0].id, reference: row.booking.reference } }).onConflictDoNothing();
      created += 1;
    }
  }
  return created;
}

async function enqueuePaymentRemindersAndStuckPayments(): Promise<number> {
  const dueSoon = await getDb().select({ scheduleId: bookingPaymentSchedules.id, bookingId: bookings.id, reference: bookings.reference })
    .from(bookingPaymentSchedules).innerJoin(bookings, eq(bookings.id, bookingPaymentSchedules.bookingId))
    .where(and(eq(bookingPaymentSchedules.status, "PENDING"), lte(bookingPaymentSchedules.dueAt, addHours(new Date(), 24)), inArray(bookings.status, ["AWAITING_PAYMENT", "CONFIRMED"]))).limit(200);
  for (const item of dueSoon) await getDb().insert(outboxEvents).values({ deduplicationKey: `payment-reminder-${item.scheduleId}`, queueName: "notifications", eventType: "PAYMENT_DEADLINE_APPROACHING", aggregateType: "booking", aggregateId: item.bookingId, payload: { bookingId: item.bookingId, reference: item.reference, scheduleId: item.scheduleId } }).onConflictDoNothing();
  const stuckBefore = subHours(new Date(), 1);
  await getDb().execute(sql`
    insert into internal.staff_tasks (entity_type, entity_id, title, priority, status, due_at)
    select 'payment', payment.id, 'Reconcile stalled Whop checkout', 'HIGH', 'OPEN', now()
    from payments as payment
    join payment_checkout_sessions as session on session.payment_id = payment.id
    where payment.provider = 'WHOP' and payment.status = 'PROCESSING' and payment.updated_at <= ${stuckBefore}
      and not exists (select 1 from internal.staff_tasks as task where task.entity_type = 'payment' and task.entity_id = payment.id and task.status = 'OPEN')`);
  return dueSoon.length;
}

export async function runScheduledJobs(): Promise<Readonly<Record<string, number | Readonly<Record<string, number>>>>> {
  const expired = await expireInventoryAndQuotes();
  const reviewsPublished = await publishEligibleReviews();
  const payoutsCreated = await createEligiblePayouts();
  const remindersQueued = await enqueuePaymentRemindersAndStuckPayments();
  const outbox = await processOutboxBatch(60);
  return { expired, reviewsPublished, payoutsCreated, remindersQueued, outbox };
}

function inArrayValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}
