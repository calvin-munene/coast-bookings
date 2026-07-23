"use client";

import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";

export function CoastWhopCheckout({ sessionId, paymentId, environment }: Readonly<{ sessionId: string; paymentId: string; environment: "sandbox" | "production" }>) {
  const router = useRouter();
  const returnUrl = typeof window === "undefined" ? undefined : `${window.location.origin}/checkout/status?paymentId=${encodeURIComponent(paymentId)}`;
  return <div className="whop-checkout-frame">
    <WhopCheckoutEmbed
      sessionId={sessionId}
      environment={environment}
      returnUrl={returnUrl}
      theme="light"
      adaptivePricing={false}
      collectPhoneNumbers
      themeOptions={{ accentColor: "#f47721", borderRadius: 9, buttonText: "Pay securely" }}
      fallback={<div className="checkout-loading">Loading secure checkout...</div>}
      onComplete={() => router.replace(`/checkout/status?paymentId=${encodeURIComponent(paymentId)}`)}
    />
  </div>;
}
