import { NextRequest, NextResponse } from "next/server";
import { properties } from "@/data/demo";
import { searchSchema } from "@/modules/search/validators";
import { fail } from "@/lib/api";

export function GET(request: NextRequest) {
  const result = searchSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) return fail("INVALID_SEARCH", "Search parameters are invalid", 400, result.error.flatten());
  const input = result.data;
  const matches = properties.filter((property) => {
    if (input.destination && !property.location.toLowerCase().includes(input.destination.toLowerCase())) return false;
    if (input.instantBook && !property.instantBook) return false;
    if (input.minPriceMinor !== undefined && property.priceMinor < input.minPriceMinor) return false;
    if (input.maxPriceMinor !== undefined && property.priceMinor > input.maxPriceMinor) return false;
    return true;
  });
  return NextResponse.json({ data: matches, meta: { count: matches.length, sandbox: true } });
}
