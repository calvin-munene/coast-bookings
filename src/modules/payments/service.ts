import "server-only";

import { addMinutes } from "date-fns";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { bookingPaymentSchedules, bookings, inventoryHolds, paymentCheckoutSessions, payments, pricingSnapshots, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import type { CreateCheckoutSchemaInput } from "./validators";
import { WhopPaymentProvider } from "./providers/whop";

export type CheckoutSessionResult = Readonly<{
  bookingId: string;
  paymentId: string;
  sessionId: string;
  planId: string | null;
  amountMinor: number;
  currency: "KES";
  expiresAt: string;
  environment: "sandbox" | "production";
}>;

export async function createWhopCheckout(userId: string, input: CreateCheckoutSchemaInput): Promise<CheckoutSessionResult> {
  const [row] = await getDb().select({ booking: bookings, quote: pricingSnapshots, hold: inventoryHolds, guest: users })
    .from(bookings)
    .innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id))
    .leftJoin(inventoryHolds, eq(inventoryHolds.id, bookings.holdId))
    .innerJoin(users, eq(users.id, bookings.guestUserId))
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.guestUserId, userId))).limit(1);
  if (!row) throw new Error("Booking is unavailable");
  const payingConfirmedBalance = row.booking.status === "CONFIRMED" && row.booking.paymentStatus === "PARTIALLY_PAID";
  if (!payingConfirmedBalance && !inArrayValue(row.booking.status, ["AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED"])) throw new Error("Booking is not ready for payment");
  if (!payingConfirmedBalance && (!row.hold || row.hold.status !== "ACTIVE" || row.hold.expiresAt <= new Date())) throw new Error("The inventory hold has expired");

  const [existing] = await getDb().select({ session: paymentCheckoutSessions, payment: payments })
    .from(paymentCheckoutSessions).innerJoin(payments, eq(payments.id, paymentCheckoutSessions.paymentId))
    .where(and(eq(payments.bookingId, row.booking.id), eq(paymentCheckoutSessions.status, "OPEN"), gt(paymentCheckoutSessions.expiresAt, new Date())))
    .orderBy(paymentCheckoutSessions.createdAt).limit(1);
  if (existing) return {
    bookingId: row.booking.id,
    paymentId: existing.payment.id,
    sessionId: existing.session.providerSessionId,
    planId: existing.session.providerPlanId,
    amountMinor: Number(existing.session.amountMinor),
    currency: "KES",
    expiresAt: existing.session.expiresAt.toISOString(),
    environment: getEnv().PAYMENT_MODE === "live" ? "production" : "sandbox",
  };

  const [schedule] = await getDb().select().from(bookingPaymentSchedules).where(and(eq(bookingPaymentSchedules.bookingId, row.booking.id), eq(bookingPaymentSchedules.status, "PENDING"))).orderBy(bookingPaymentSchedules.sequence).limit(1);
  if (!schedule && payingConfirmedBalance) throw new Error("No outstanding payment is due for this booking");
  const paymentReference = `PAY-${row.booking.reference}-${schedule?.sequence ?? 1}`;
  const amountMinor = schedule?.amountMinor ?? row.quote.guestTotalMinor;
  const payment = await getDb().transaction(async (tx) => {
    const [saved] = await tx.insert(payments).values({
      reference: paymentReference,
      bookingId: row.booking.id,
      provider: "WHOP",
      amountMinor,
      currency: "KES",
      method: "WHOP_CHECKOUT",
      status: "PENDING",
      telephone: row.guest.phone,
    }).onConflictDoUpdate({ target: payments.reference, set: { updatedAt: new Date() } }).returning();
    if (schedule) await tx.update(bookingPaymentSchedules).set({ paymentId: saved.id, updatedAt: new Date() }).where(eq(bookingPaymentSchedules.id, schedule.id));
    return saved;
  });
  const checkoutExpiry = addMinutes(new Date(), 30);
  const expiresAt = row.hold && row.booking.status !== "CONFIRMED" && row.hold.expiresAt < checkoutExpiry ? row.hold.expiresAt : checkoutExpiry;
  const returnUrl = new URL(`/checkout/status?paymentId=${payment.id}`, getEnv().NEXT_PUBLIC_APP_URL).toString();
  const provider = new WhopPaymentProvider();
  const initiated = await provider.initiatePayment({
    bookingId: row.booking.id,
    bookingReference: row.booking.reference,
    amount: { amountMinor: amountMinor.toString(), currency: "KES" },
    method: "WHOP_CHECKOUT",
    customerEmail: row.guest.primaryEmail,
    customerPhone: row.guest.phone ?? undefined,
    idempotencyKey: input.idempotencyKey,
    callbackUrl: returnUrl,
    metadata: { payment_id: payment.id },
  });
  if (!initiated.checkoutSessionId) throw new Error("Whop did not return a checkout session");
  await getDb().transaction(async (tx) => {
    await tx.insert(paymentCheckoutSessions).values({
      paymentId: payment.id,
      providerSessionId: initiated.checkoutSessionId!,
      providerPlanId: initiated.planId,
      amountMinor,
      returnUrl,
      metadata: { booking_id: row.booking.id, booking_reference: row.booking.reference, payment_id: payment.id },
      expiresAt,
    }).onConflictDoNothing();
    await tx.update(payments).set({ status: "PROCESSING", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    if (row.booking.status !== "CONFIRMED") {
      await tx.update(bookings).set({ status: "PAYMENT_PROCESSING", paymentStatus: "PROCESSING", updatedAt: new Date(), version: sql`${bookings.version} + 1` }).where(and(eq(bookings.id, row.booking.id), inArray(bookings.status, ["AWAITING_PAYMENT", "PAYMENT_FAILED", "PAYMENT_PROCESSING"])));
    }
  });
  return { bookingId: row.booking.id, paymentId: payment.id, sessionId: initiated.checkoutSessionId, planId: initiated.planId ?? null, amountMinor: Number(amountMinor), currency: "KES", expiresAt: expiresAt.toISOString(), environment: getEnv().PAYMENT_MODE === "live" ? "production" : "sandbox" };
}

function inArrayValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}
