import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ExistingBookingCheckout } from "@/components/existing-booking-checkout";
import { getDb } from "@/db/connection";
import { bookingPaymentSchedules, bookings, pricingSnapshots } from "@/db/schema";
import { formatMoney } from "@/lib/format";
import { requireGuest } from "@/modules/authorization/service";

export const dynamic = "force-dynamic";

export default async function GroupCheckoutPage({ searchParams }: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const rawBookingId = (await searchParams).bookingId;
  const bookingId = typeof rawBookingId === "string" ? rawBookingId : "";
  const context = await requireGuest();
  const [row] = await getDb().select({ booking: bookings, total: pricingSnapshots.guestTotalMinor })
    .from(bookings).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.guestUserId, context.user.id))).limit(1);
  if (!row) redirect("/guest/group-enquiries");
  const [nextPayment] = await getDb().select().from(bookingPaymentSchedules).where(and(eq(bookingPaymentSchedules.bookingId, bookingId), eq(bookingPaymentSchedules.status, "PENDING"))).orderBy(bookingPaymentSchedules.sequence).limit(1);
  return <main className="secure-payment-shell"><header><span className="section-kicker">Group booking {row.booking.reference}</span><h1>Your option is reserved</h1><p>The selected property inventory is held while you complete the first payment.</p></header><section className="payment-summary-card"><div><span>Booking total</span><strong>{formatMoney(Number(row.total))}</strong></div><div><span>Due now</span><strong>{formatMoney(Number(nextPayment?.amountMinor ?? row.total))}</strong></div><p>{"Future balance payments remain visible in your guest portal. The booking is confirmed only from Whop's verified webhook."}</p><ExistingBookingCheckout bookingId={bookingId} /></section></main>;
}
