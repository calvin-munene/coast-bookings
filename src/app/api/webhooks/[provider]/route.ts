import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api";
import { sha256 } from "@/modules/payments/crypto";

const providerSchema = z.enum(["daraja", "pesapal"]);

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const provider = providerSchema.safeParse(rawProvider);
  if (!provider.success) return fail("UNKNOWN_PROVIDER", "Unsupported payment provider", 404);
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return fail("PAYLOAD_TOO_LARGE", "Webhook body is too large", 413);
  const eventId = request.headers.get("x-provider-event-id") ?? request.headers.get("x-request-id");
  if (!eventId) return fail("MISSING_EVENT_ID", "A stable provider event ID is required", 400);

  // Production processing first verifies the provider signature, then inserts the
  // unique (provider,event_id) before any ledger or booking state mutation.
  return NextResponse.json({ received: true, provider: provider.data, eventId, payloadHash: await sha256(rawBody), paymentStateChanged: false });
}
