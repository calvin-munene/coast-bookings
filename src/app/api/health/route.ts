import { NextResponse } from "next/server";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "coast-bookings",
    database: { provider: "replit-postgresql", configured: isDatabaseConfigured() },
    authentication: { provider: "clerk", configured: isClerkConfigured() },
    storage: { provider: "replit-app-storage" },
    timestamp: new Date().toISOString(),
  });
}
