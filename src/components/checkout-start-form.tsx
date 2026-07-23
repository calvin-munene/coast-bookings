"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

type BookingPayload = Readonly<{
  unitId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  promotionCode?: string;
  mealFeeMinor: number;
  servicesMinor: number;
}>;

type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

export function CheckoutStartForm({ payload, requestToBook }: Readonly<{ payload: BookingPayload; requestToBook: boolean }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startBooking(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, guestRequirements: String(formData.get("guestRequirements") ?? ""), idempotencyKey }),
      });
      const bookingBody = await bookingResponse.json() as ApiEnvelope<{ id: string; status: string }>;
      if (!bookingResponse.ok || !bookingBody.data) throw new Error(bookingBody.error?.message ?? "Booking could not be created");
      if (bookingBody.data.status === "PENDING_HOST_APPROVAL") {
        router.push(`/guest/pending-requests?booking=${bookingBody.data.id}`);
        return;
      }
      const paymentResponse = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: bookingBody.data.id, idempotencyKey: `${idempotencyKey}-payment` }),
      });
      const paymentBody = await paymentResponse.json() as ApiEnvelope<{ paymentId: string; sessionId: string; environment: string }>;
      if (!paymentResponse.ok || !paymentBody.data) throw new Error(paymentBody.error?.message ?? "Secure checkout could not be started");
      const query = new URLSearchParams({ paymentId: paymentBody.data.paymentId, sessionId: paymentBody.data.sessionId, environment: paymentBody.data.environment });
      router.push(`/checkout/payment?${query.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started");
      setBusy(false);
    }
  }

  return <form action={startBooking}>
    <label className="field"><span>Special requests (optional)</span><textarea name="guestRequirements" maxLength={2000} placeholder="Arrival time, accessibility needs or anything the property should know" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={busy}><LockKeyhole size={17} /> {busy ? "Securing inventory..." : requestToBook ? "Send booking request" : "Continue to secure Whop checkout"}</button>
    <p className="booking-assurance">{"The browser cannot mark this booking paid. Confirmation occurs only after Coast Bookings verifies Whop's signed webhook."}</p>
  </form>;
}
