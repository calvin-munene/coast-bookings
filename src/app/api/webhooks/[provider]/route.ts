import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api";
import { processWhopWebhook } from "@/modules/payments/whop-webhook-service";

const providerSchema = z.literal("whop");

export async function POST(request: Request, { params }: Readonly<{ params: Promise<{ provider: string }> }>) {
  const provider = providerSchema.safeParse((await params).provider);
  if (!provider.success) return fail("UNKNOWN_PROVIDER", "Only Whop accepts online payment webhooks", 404);
  const rawBody = await request.text();
  if (rawBody.length === 0) return fail("EMPTY_WEBHOOK", "Webhook body is required", 400);
  if (rawBody.length > 1_000_000) return fail("PAYLOAD_TOO_LARGE", "Webhook body is too large", 413);
  if (!request.headers.get("webhook-id") || !request.headers.get("webhook-signature") || !request.headers.get("webhook-timestamp")) return fail("MISSING_SIGNATURE", "Whop signature headers are required", 400);
  try {
    const result = await processWhopWebhook(rawBody, request.headers);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Whop webhook failed validation";
    const signatureFailure = /signature|timestamp|webhook|company/i.test(message);
    return fail(signatureFailure ? "INVALID_WEBHOOK" : "WEBHOOK_PROCESSING_FAILED", message, signatureFailure ? 401 : 500);
  }
}
