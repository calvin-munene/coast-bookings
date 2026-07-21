import { NextResponse } from "next/server";
import { getEnv, isDatabaseConfigured, isSupabaseAuthConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const env = getEnv();
  return NextResponse.json({
    status: "ok",
    service: "coast-bookings",
    database: { provider: env.DATABASE_PROVIDER, configured: isDatabaseConfigured() },
    authentication: { provider: env.AUTH_PROVIDER, configured: isSupabaseAuthConfigured() },
    timestamp: new Date().toISOString(),
  });
}
