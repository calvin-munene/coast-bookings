import { getEnv } from "@/lib/env";
import { sha256 } from "../crypto";
import type {
  ParsedWebhook,
  PaymentInitiation,
  PaymentProvider,
  PaymentRequest,
  PaymentVerification,
  RefundRequest,
  RefundResult,
} from "../types";

export class PesapalPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;

  constructor(private readonly fetcher: typeof fetch = fetch) {
    this.baseUrl = getEnv().PAYMENT_MODE === "live"
      ? "https://pay.pesapal.com/v3"
      : "https://cybqa.pesapal.com/pesapalv3";
  }

  private async token(): Promise<string> {
    const env = getEnv();
    if (!env.PESAPAL_CONSUMER_KEY || !env.PESAPAL_CONSUMER_SECRET) {
      throw new Error("Pesapal credentials are not configured");
    }
    const response = await this.fetcher(`${this.baseUrl}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        consumer_key: env.PESAPAL_CONSUMER_KEY,
        consumer_secret: env.PESAPAL_CONSUMER_SECRET,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Pesapal authentication failed with ${response.status}`);
    const result = (await response.json()) as { token?: string };
    if (!result.token) throw new Error("Pesapal did not return an access token");
    return result.token;
  }

  async initiatePayment(input: PaymentRequest): Promise<PaymentInitiation> {
    const token = await this.token();
    const response = await this.fetcher(`${this.baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: input.idempotencyKey,
        currency: "KES",
        amount: Number(input.amount.amountMinor) / 100,
        description: `Coast Bookings ${input.bookingReference}`,
        callback_url: input.callbackUrl,
        notification_id: process.env.PESAPAL_IPN_ID,
        billing_address: { email_address: input.customerEmail, phone_number: input.customerPhone },
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Pesapal order creation failed with ${response.status}`);
    const result = (await response.json()) as { order_tracking_id: string; redirect_url: string };
    return {
      provider: "PESAPAL",
      providerReference: result.order_tracking_id,
      status: "REQUIRES_ACTION",
      redirectUrl: result.redirect_url,
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const token = await this.token();
    const response = await this.fetcher(
      `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Pesapal verification failed with ${response.status}`);
    const result = (await response.json()) as {
      payment_status_description?: string;
      amount?: number;
      confirmation_code?: string;
      created_date?: string;
    };
    return {
      providerReference: reference,
      status: result.payment_status_description === "Completed" ? "SUCCEEDED" : "PENDING",
      paidAmount: { amountMinor: String(Math.round((result.amount ?? 0) * 100)), currency: "KES" },
      paidAt: result.created_date,
      providerTransactionId: result.confirmation_code,
    };
  }

  async refundPayment(input: RefundRequest): Promise<RefundResult> {
    return { providerReference: input.paymentReference, status: "PENDING" };
  }

  async parseWebhook(rawBody: string): Promise<ParsedWebhook> {
    const payload = JSON.parse(rawBody) as { OrderTrackingId?: string; OrderNotificationType?: string };
    const hash = await sha256(rawBody);
    return {
      providerEventId: `${payload.OrderTrackingId ?? "unknown"}:${payload.OrderNotificationType ?? hash}`,
      providerReference: payload.OrderTrackingId ?? "unknown",
      payloadHash: hash,
      rawPayload: payload,
    };
  }
}
