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

type DarajaTokenResponse = { access_token: string; expires_in: string };
type DarajaStkResponse = {
  CheckoutRequestID: string;
  ResponseCode: string;
  CustomerMessage?: string;
};

export class DarajaPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;

  constructor(private readonly fetcher: typeof fetch = fetch) {
    this.baseUrl = getEnv().PAYMENT_MODE === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  }

  private async accessToken(): Promise<string> {
    const env = getEnv();
    if (!env.DARAJA_CONSUMER_KEY || !env.DARAJA_CONSUMER_SECRET) {
      throw new Error("Daraja credentials are not configured");
    }
    const authorization = Buffer.from(
      `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`,
    ).toString("base64");
    const response = await this.fetcher(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${authorization}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Daraja OAuth failed with ${response.status}`);
    return ((await response.json()) as DarajaTokenResponse).access_token;
  }

  async initiatePayment(input: PaymentRequest): Promise<PaymentInitiation> {
    const env = getEnv();
    if (!input.customerPhone || !env.DARAJA_SHORTCODE || !env.DARAJA_PASSKEY) {
      throw new Error("M-Pesa phone and Daraja shortcode configuration are required");
    }
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = Buffer.from(`${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`).toString("base64");
    const token = await this.accessToken();
    const response = await this.fetcher(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(Number(input.amount.amountMinor) / 100),
        PartyA: input.customerPhone,
        PartyB: env.DARAJA_SHORTCODE,
        PhoneNumber: input.customerPhone,
        CallBackURL: input.callbackUrl,
        AccountReference: input.bookingReference,
        TransactionDesc: `Coast Bookings ${input.bookingReference}`,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Daraja STK initiation failed with ${response.status}`);
    const result = (await response.json()) as DarajaStkResponse;
    if (result.ResponseCode !== "0") throw new Error(result.CustomerMessage ?? "Daraja declined the request");
    return {
      provider: "DARAJA",
      providerReference: result.CheckoutRequestID,
      status: "PENDING",
      customerMessage: result.CustomerMessage,
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
    const payload = JSON.parse(rawBody) as {
      Body?: { stkCallback?: { CheckoutRequestID?: string; MerchantRequestID?: string } };
    };
    const callback = payload.Body?.stkCallback;
    const hash = await sha256(rawBody);
    return {
      providerEventId: callback?.MerchantRequestID ?? hash,
      providerReference: callback?.CheckoutRequestID ?? "unknown",
      payloadHash: hash,
      rawPayload: payload,
    };
  }
}
