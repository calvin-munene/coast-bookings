import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { sha256 } from "@/modules/payments/crypto";
import { processClerkWebhook } from "@/modules/auth/clerk-webhook";

export async function POST(request: NextRequest) {
  const rawBody = await request.clone().text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const eventId = request.headers.get("webhook-id");
  if (!eventId) return NextResponse.json({ error: "Missing webhook ID" }, { status: 400 });
  try {
    const event: unknown = await verifyWebhook(request);
    const result = await processClerkWebhook({ eventId, event, payloadHash: await sha256(rawBody) });
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("Clerk webhook rejected", { eventId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Webhook rejected" }, { status: 400 });
  }
}
