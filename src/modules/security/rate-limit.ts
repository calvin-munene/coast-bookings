import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { isDatabaseConfigured } from "@/lib/env";

export type RateLimitResult = Readonly<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>;

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function requestFingerprint(request: Request): string {
  const address = request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown";
  return hash(`${address}|${agent}`);
}

export async function consumeRateLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!isDatabaseConfigured()) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const keyHash = hash(`${scope}|${identity}`);
  const rows = await getDb().execute<{ count: number; expires_at: Date }>(sql`
    INSERT INTO request_rate_limits (key_hash, scope, window_started_at, count, expires_at)
    VALUES (${keyHash}, ${scope}, ${now}, 1, ${expiresAt})
    ON CONFLICT (key_hash) DO UPDATE SET
      window_started_at = CASE WHEN request_rate_limits.expires_at <= ${now} THEN ${now} ELSE request_rate_limits.window_started_at END,
      count = CASE WHEN request_rate_limits.expires_at <= ${now} THEN 1 ELSE request_rate_limits.count + 1 END,
      expires_at = CASE WHEN request_rate_limits.expires_at <= ${now} THEN ${expiresAt} ELSE request_rate_limits.expires_at END
    RETURNING count, expires_at
  `);
  const row = rows[0];
  if (!row) throw new Error("Rate-limit state was not returned");
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfterSeconds: Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - now.getTime()) / 1000)) };
}
