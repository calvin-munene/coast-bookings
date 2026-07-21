import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function fail(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ error: code, message, ...(details === undefined ? {} : { details }) }, { status });
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Please check the submitted details.", issues: error.flatten() },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(JSON.stringify({ level: "error", message, timestamp: new Date().toISOString() }));
  return NextResponse.json({ error: "REQUEST_FAILED", message }, { status: 500 });
}

export function getIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 128) {
    throw new Error("A valid Idempotency-Key header is required");
  }
  return key;
}
