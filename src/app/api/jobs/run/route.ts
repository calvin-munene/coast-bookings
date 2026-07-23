import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runScheduledJobs } from "@/jobs/processor";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const configured = getEnv().CRON_SHARED_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !supplied) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = await runScheduledJobs();
  return NextResponse.json({ data: result, completedAt: new Date().toISOString() });
}
