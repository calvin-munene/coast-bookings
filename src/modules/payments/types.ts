import type { MoneyDto } from "@/modules/shared/money";

export type PaymentMethod = "MPESA_STK" | "CARD" | "BANK_TRANSFER" | "MANUAL_MPESA" | "OFFLINE";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type PaymentRequest = Readonly<{
  bookingId: string;
  bookingReference: string;
  amount: MoneyDto;
  method: PaymentMethod;
  customerEmail: string;
  customerPhone?: string;
  idempotencyKey: string;
  callbackUrl: string;
}>;

export type PaymentInitiation = Readonly<{
  provider: "DARAJA" | "PESAPAL" | "MANUAL";
  providerReference: string;
  status: "PENDING" | "REQUIRES_ACTION";
  redirectUrl?: string;
  customerMessage?: string;
}>;

export type PaymentVerification = Readonly<{
  providerReference: string;
  status: PaymentStatus;
  paidAmount: MoneyDto;
  paidAt?: string;
  providerTransactionId?: string;
}>;

export type RefundRequest = Readonly<{
  paymentReference: string;
  amount: MoneyDto;
  reason: string;
  idempotencyKey: string;
}>;

export type RefundResult = Readonly<{
  providerReference: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
}>;

export type ParsedWebhook = Readonly<{
  providerEventId: string;
  providerReference: string;
  payloadHash: string;
  rawPayload: unknown;
}>;

export interface PaymentProvider {
  initiatePayment(input: PaymentRequest): Promise<PaymentInitiation>;
  verifyPayment(reference: string): Promise<PaymentVerification>;
  refundPayment(input: RefundRequest): Promise<RefundResult>;
  parseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook>;
}
