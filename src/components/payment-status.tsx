"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentRecord = Readonly<{ status: string; bookingStatus: string; bookingReference: string }>;

export function PaymentStatus({ paymentId, initial }: Readonly<{ paymentId: string; initial: PaymentRecord }>) {
  const [payment, setPayment] = useState(initial);
  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    if (["SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"].includes(payment.status) || attempts >= 20) return;
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      if (response.ok) {
        const body = await response.json() as { data: PaymentRecord };
        setPayment(body.data);
      }
      setAttempts((value) => value + 1);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [attempts, payment.status, paymentId]);
  const confirmed = payment.status === "SUCCEEDED" && payment.bookingStatus === "CONFIRMED";
  const review = payment.bookingStatus === "PAYMENT_REVIEW";
  return <div className={`payment-result ${confirmed ? "success" : review ? "review" : "pending"}`}>
    <span className="section-kicker">Booking {payment.bookingReference}</span>
    <h1>{confirmed ? "Your stay is confirmed" : review ? "Payment received — review in progress" : payment.status === "FAILED" ? "Payment was not completed" : "Verifying your payment"}</h1>
    <p>{confirmed ? "Your receipt, voucher and check-in details are available in your guest portal." : review ? "We received the provider payment, but inventory or payment details need an operations review. You will not be charged again." : payment.status === "FAILED" ? "No booking was confirmed. Return to your payments page to try again." : "Whop is sending the signed payment result to Coast Bookings. This page updates automatically."}</p>
    <Link className="button" href="/guest/upcoming-stays">Open my trips</Link>
  </div>;
}
