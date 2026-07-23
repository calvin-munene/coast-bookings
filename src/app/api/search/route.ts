import { NextRequest, NextResponse } from "next/server";
import { searchSchema } from "@/modules/search/validators";
import { fail } from "@/lib/api";
import { searchMarketplace } from "@/modules/marketplace/repository";

export async function GET(request: NextRequest) {
  const result = searchSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) return fail("INVALID_SEARCH", "Search parameters are invalid", 400, result.error.flatten());
  const matches = await searchMarketplace(result.data);
  return NextResponse.json({ data: matches.properties, meta: { count: matches.count, page: matches.page, pageSize: matches.pageSize } });
}
