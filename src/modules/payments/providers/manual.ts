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

export class ManualPaymentProvider implements PaymentProvider {
  async initiatePayment(input: PaymentRequest): Promise<PaymentInitiation> {
    return {
      provider: "MANUAL",
      providerReference: `MAN-${input.bookingReference}-${input.idempotencyKey.slice(0, 8)}`,
      status: "PENDING",
      customerMessage: "Payment instructions have been recorded for finance follow-up.",
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    return {
      providerReference: reference,
      status: "PENDING",
      paidAmount: { amountMinor: "0", currency: "KES" },
    };
  }

  async refundPayment(input: RefundRequest): Promise<RefundResult> {
    return { providerReference: input.paymentReference, status: "PENDING" };
  }

  async parseWebhook(rawBody: string): Promise<ParsedWebhook> {
    return {
      providerEventId: `manual-${await sha256(rawBody)}`,
      providerReference: "manual",
      payloadHash: await sha256(rawBody),
      rawPayload: JSON.parse(rawBody) as unknown,
    };
  }
}
