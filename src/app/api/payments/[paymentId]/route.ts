import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { bookings, payments } from "@/db/schema";
import { fail } from "@/lib/api";
import { requirePaymentAccess } from "@/modules/authorization/service";

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ paymentId: string }> }>) {
  const { paymentId } = await params;
  try {
    await requirePaymentAccess(paymentId);
    const [record] = await getDb().select({ id: payments.id, reference: payments.reference, status: payments.status, amountMinor: payments.amountMinor, currency: payments.currency, method: payments.method, bookingId: payments.bookingId, bookingReference: bookings.reference, bookingStatus: bookings.status, paidAt: payments.paidAt }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).where(eq(payments.id, paymentId)).limit(1);
    if (!record) return fail("PAYMENT_NOT_FOUND", "Payment was not found", 404);
    return NextResponse.json({ data: { ...record, amountMinor: record.amountMinor.toString(), paidAt: record.paidAt?.toISOString() ?? null } });
  } catch {
    return fail("PAYMENT_NOT_FOUND", "Payment was not found", 404);
  }
}
