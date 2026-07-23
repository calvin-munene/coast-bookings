import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { acceptGroupQuoteAction } from "./actions";
import { formatMoney } from "@/lib/format";
import { requireGuest } from "@/modules/authorization/service";
import { getGroupQuoteForAcceptance } from "@/modules/group-bookings/quote-acceptance-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group quotation", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GroupQuotePage({ params, searchParams }: Readonly<{ params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }>) {
  const { reference } = await params;
  const rawToken = (await searchParams).token;
  const token = typeof rawToken === "string" ? rawToken : "";
  if (!token) notFound();
  const session = await auth();
  if (!session.userId) {
    const returnPath = `/group-quotes/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`;
    return <main className="quote-acceptance-shell"><section className="quote-login-card"><span className="section-kicker">Private group quotation</span><h1>Sign in to review your options</h1><p>Use the email address that received this Coast Bookings quotation.</p><Link className="button" href={`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`}>Sign in securely</Link></section></main>;
  }
  const context = await requireGuest();
  const quote = await getGroupQuoteForAcceptance(reference, token, context.user);
  if (!quote) notFound();
  return <main className="quote-acceptance-shell"><header className="quote-heading"><span className="section-kicker">Quotation {quote.reference}</span><h1>{quote.organisationName}</h1><p>{quote.destination} · {quote.checkIn} to {quote.checkOut} · valid until {quote.expiresAt.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p></header><div className="quote-option-grid">{quote.options.map((option) => <article className="quote-option-card" key={option.id}><div><span className="status-pill success">Inventory held</span><h2>{option.title}</h2><p><strong>{option.propertyName}</strong> · {option.unitName}</p><p>{option.roomingArrangement}</p></div><div className="quote-list"><strong>Included</strong>{option.inclusions.length ? <ul>{option.inclusions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>As described in the rooming arrangement.</p>}<strong>Excluded</strong>{option.exclusions.length ? <ul>{option.exclusions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional exclusions recorded.</p>}</div><div className="quote-price"><span>Total</span><strong>{formatMoney(option.totalMinor)}</strong><small>Deposit due after acceptance: {formatMoney(option.depositMinor || option.totalMinor)}</small></div><details><summary>Cancellation policy</summary><p>{option.cancellationPolicy}</p></details><form action={acceptGroupQuoteAction}><input type="hidden" name="reference" value={reference} /><input type="hidden" name="optionId" value={option.id} /><input type="hidden" name="token" value={token} /><label className="field"><span>Name of authorised acceptor</span><input name="acceptedByName" required minLength={3} defaultValue={context.user.fullName} /></label><label className="consent-row"><input type="checkbox" name="termsAccepted" value="yes" required /><span>I accept this option, its payment deadlines, and its cancellation policy.</span></label><button className="button" type="submit">Accept option and pay deposit</button></form></article>)}</div></main>;
}
