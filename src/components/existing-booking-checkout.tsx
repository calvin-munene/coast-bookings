"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

export function ExistingBookingCheckout({ bookingId }: Readonly<{ bookingId: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function begin() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, idempotencyKey: crypto.randomUUID() }) });
    const body = await response.json() as { data?: { paymentId: string; sessionId: string; environment: string }; message?: string };
    if (!response.ok || !body.data) {
      setError(body.message ?? "Secure checkout could not be started");
      setBusy(false);
      return;
    }
    router.push(`/checkout/payment?${new URLSearchParams({ paymentId: body.data.paymentId, sessionId: body.data.sessionId, environment: body.data.environment }).toString()}`);
  }
  return <div><button className="button" type="button" disabled={busy} onClick={begin}><LockKeyhole size={17} />{busy ? "Preparing checkout..." : "Continue to secure Whop checkout"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
