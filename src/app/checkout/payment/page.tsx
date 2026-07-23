import { redirect } from "next/navigation";
import { CoastWhopCheckout } from "@/components/whop-checkout";

type SearchParams = Record<string, string | string[] | undefined>;
export default async function PaymentPage({ searchParams }: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const params = await searchParams;
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : "";
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const environment = params.environment === "production" ? "production" : "sandbox";
  if (!paymentId || !sessionId) redirect("/guest/payments");
  return <div className="secure-payment-shell"><header><span className="section-kicker">Whop secure checkout</span><h1>Complete your booking payment</h1><p>Coast Bookings confirms your reservation only after the signed provider webhook is verified.</p></header><CoastWhopCheckout paymentId={paymentId} sessionId={sessionId} environment={environment} /></div>;
}
