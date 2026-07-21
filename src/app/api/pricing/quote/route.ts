import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { calculatePrice } from "@/modules/pricing/service";
import { priceRequestSchema } from "@/modules/pricing/validators";

export async function POST(request: Request) {
  const result = priceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return fail("INVALID_PRICE_REQUEST", "Pricing input is invalid", 400, result.error.flatten());
  try {
    const quote = calculatePrice(result.data);
    return NextResponse.json({ data: JSON.parse(JSON.stringify(quote, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value)) });
  } catch (error) {
    return fail("PRICING_FAILED", error instanceof Error ? error.message : "Pricing failed", 422);
  }
}
