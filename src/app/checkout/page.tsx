import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole } from "lucide-react";
import { CheckoutStartForm } from "@/components/checkout-start-form";
import { formatKes } from "@/lib/format";
import { calculateBookingQuote, type BookingQuote } from "@/modules/bookings/quote-service";
import { bookingQuoteSchema } from "@/modules/bookings/validators";

export const metadata: Metadata = { title: "Secure checkout" };

type SearchParams = Record<string, string | string[] | undefined>;

function values(params: SearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
}

function UnavailableStay({ message, returnHref }: Readonly<{ message: string; returnHref: string }>) {
  return (
    <div className="auth-shell">
      <section className="form-card">
        <span className="section-kicker">Stay unavailable</span>
        <h1>Choose different dates</h1>
        <p>{message}</p>
        <Link className="button" href={returnHref}><ArrowLeft size={17} /> Return to the property</Link>
      </section>
    </div>
  );
}

function CheckoutQuote({ quote, payload }: Readonly<{ quote: BookingQuote; payload: ReturnType<typeof bookingQuoteSchema.parse> }>) {
  return (
    <div className="checkout-shell shell">
      <section className="checkout-summary">
        <Link href={`/stays/${quote.property.slug}`} className="back-link"><ArrowLeft size={15} /> Back to {quote.property.name}</Link>
        <span className="section-kicker">Price locked at checkout</span>
        <h1>{quote.property.name}</h1>
        <p>{quote.unit.name} · {quote.nights} night{quote.nights === 1 ? "" : "s"} · {quote.rooms} room{quote.rooms === 1 ? "" : "s"}</p>
        <div className="checkout-dates">
          <span><small>Check in</small><strong>{quote.checkIn}</strong></span>
          <span><small>Check out</small><strong>{quote.checkOut}</strong></span>
          <span><small>Guests</small><strong>{quote.adults} adults{quote.children ? `, ${quote.children} children` : ""}</strong></span>
        </div>
        <div className="price-breakdown">
          {quote.items.map((item) => <div key={`${item.code}-${item.label}`}><span>{item.label}</span><strong>{item.kind === "DISCOUNT" ? "−" : ""}{formatKes(item.amountMinor)}</strong></div>)}
          <div className="fee-total"><span>Total</span><strong>{formatKes(quote.guestTotalMinor)}</strong></div>
        </div>
        <div className="checkout-trust"><BadgeCheck /> Permanent price and cancellation-policy snapshot</div>
      </section>
      <section className="checkout-action">
        <div><LockKeyhole /><span><strong>Secure booking</strong><small>{quote.unit.bookingMode === "REQUEST_TO_BOOK" ? "The host has 24 hours to respond. Payment begins after acceptance." : "Inventory is held for 20 minutes while you pay."}</small></span></div>
        <CheckoutStartForm payload={{ ...payload, mealFeeMinor: payload.mealFeeMinor, servicesMinor: payload.servicesMinor }} requestToBook={quote.unit.bookingMode === "REQUEST_TO_BOOK"} />
      </section>
    </div>
  );
}

export default async function CheckoutPage({ searchParams }: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const raw = values(await searchParams);
  const parsed = bookingQuoteSchema.safeParse(raw);
  const returnHref = raw.stay ? `/stays/${encodeURIComponent(raw.stay)}` : "/search";
  if (!parsed.success) {
    return <UnavailableStay message="Choose a property, room, dates and guest count before starting checkout." returnHref={returnHref} />;
  }

  let quote: BookingQuote | null = null;
  let errorMessage = "This stay is no longer available.";
  try {
    quote = await calculateBookingQuote(parsed.data);
  } catch (error) {
    if (error instanceof Error) errorMessage = error.message;
  }
  if (!quote) return <UnavailableStay message={errorMessage} returnHref={returnHref} />;
  return <CheckoutQuote quote={quote} payload={parsed.data} />;
}
