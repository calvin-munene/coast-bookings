import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@/components/payment-status";
import { getDb } from "@/db/connection";
import { bookings, payments } from "@/db/schema";
import { requirePaymentAccess } from "@/modules/authorization/service";

type SearchParams = Record<string, string | string[] | undefined>;
export default async function PaymentStatusPage({ searchParams }: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const paymentId = typeof (await searchParams).paymentId === "string" ? (await searchParams).paymentId as string : "";
  if (!paymentId) notFound();
  try { await requirePaymentAccess(paymentId); } catch { notFound(); }
  const [record] = await getDb().select({ status: payments.status, bookingStatus: bookings.status, bookingReference: bookings.reference }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).where(eq(payments.id, paymentId)).limit(1);
  if (!record) notFound();
  return <div className="auth-shell"><PaymentStatus paymentId={paymentId} initial={record} /></div>;
}
