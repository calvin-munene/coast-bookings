import "server-only";

import Whop from "@whop/sdk";
import { getEnv } from "@/lib/env";
import { sha256 } from "../crypto";
import type {
  ParsedWebhook,
  PaymentInitiation,
  PaymentProvider,
  PaymentRequest,
  PaymentStatus,
  PaymentVerification,
  RefundRequest,
  RefundResult,
} from "../types";

function whopClient(): Whop {
  const env = getEnv();
  if (!env.WHOP_API_KEY) throw new Error("WHOP_API_KEY is not configured");
  return new Whop({
    apiKey: env.WHOP_API_KEY,
    webhookKey: env.WHOP_WEBHOOK_SECRET ?? null,
    baseURL: env.PAYMENT_MODE === "live" ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1",
    maxRetries: 2,
    timeout: 15_000,
  });
}

function toMinor(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Whop returned an invalid payment amount");
  return String(Math.round(amount * 100));
}

function mapStatus(status: string | null, substatus: string): PaymentStatus {
  if (status === "paid" || substatus === "succeeded") return "SUCCEEDED";
  if (substatus === "refunded" || substatus === "auto_refunded") return "REFUNDED";
  if (substatus === "partially_refunded") return "PARTIALLY_REFUNDED";
  if (substatus.includes("dispute") || substatus.includes("resolution")) return "DISPUTED";
  if (["failed", "canceled", "uncollectible", "price_too_low"].includes(substatus)) return "FAILED";
  return status === "pending" || substatus === "pending" ? "PROCESSING" : "PENDING";
}

export class WhopPaymentProvider implements PaymentProvider {
  private readonly client: Whop;

  constructor(client: Whop = whopClient()) {
    this.client = client;
  }

  async initiatePayment(input: PaymentRequest): Promise<PaymentInitiation> {
    const env = getEnv();
    if (!env.WHOP_COMPANY_ID) throw new Error("WHOP_COMPANY_ID is not configured");
    const amount = Number(input.amount.amountMinor) / 100;
    if (!Number.isSafeInteger(Number(input.amount.amountMinor)) || amount <= 0) {
      throw new Error("Whop checkout amount must be a positive safe integer in minor units");
    }

    const checkout = await this.client.checkoutConfigurations.create({
      account_id: env.WHOP_COMPANY_ID,
      mode: "payment",
      redirect_url: input.callbackUrl,
      metadata: {
        booking_id: input.bookingId,
        booking_reference: input.bookingReference,
        idempotency_key: input.idempotencyKey,
        ...input.metadata,
      },
      plan: {
        account_id: env.WHOP_COMPANY_ID,
        initial_price: amount,
        currency: "kes",
        plan_type: "one_time",
        release_method: "buy_now",
        title: `Coast Bookings ${input.bookingReference}`,
        description: "Accommodation booking payment",
        force_create_new_plan: true,
        visibility: "hidden",
        unlimited_stock: true,
      },
      "Idempotency-Key": input.idempotencyKey,
    });

    return {
      provider: "WHOP",
      providerReference: checkout.id,
      checkoutSessionId: checkout.id,
      planId: checkout.plan?.id,
      redirectUrl: checkout.purchase_url ?? undefined,
      status: "REQUIRES_ACTION",
      customerMessage: "Complete the embedded secure checkout to confirm this booking.",
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const payment = await this.client.payments.retrieve(reference);
    if (payment.currency !== "kes" || payment.settlement_currency !== "kes") throw new Error("Whop payment currency does not match KES settlement");
    return {
      providerReference: reference,
      providerTransactionId: payment.id,
      status: mapStatus(payment.status, payment.substatus),
      paidAmount: { amountMinor: toMinor(payment.settlement_amount), currency: "KES" },
      paidAt: payment.paid_at ?? undefined,
    };
  }

  async refundPayment(input: RefundRequest): Promise<RefundResult> {
    const payment = await this.client.payments.refund(
      input.paymentReference,
      { partial_amount: Number(input.amount.amountMinor) / 100 },
      { headers: { "Idempotency-Key": input.idempotencyKey } },
    );
    const status = mapStatus(payment.status, payment.substatus);
    return {
      providerReference: payment.id,
      status: status === "REFUNDED" || status === "PARTIALLY_REFUNDED" ? "SUCCEEDED" : status === "FAILED" ? "FAILED" : "PENDING",
    };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook> {
    const event = this.client.webhooks.unwrap(rawBody, { headers: Object.fromEntries(headers.entries()) });
    const data = "data" in event && typeof event.data === "object" && event.data !== null
      ? event.data as { id?: string; checkout_configuration_id?: string }
      : undefined;
    return {
      providerEventId: headers.get("webhook-id") ?? event.id,
      providerReference: data?.id ?? data?.checkout_configuration_id ?? "unknown",
      payloadHash: await sha256(rawBody),
      rawPayload: event,
    };
  }
}
