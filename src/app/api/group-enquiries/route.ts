import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { fail } from "@/lib/api";
import { groupEnquirySchema } from "@/modules/group-bookings/validators";
import { getDb } from "@/db/connection";
import { groupEnquiries } from "@/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import { consumeRateLimit, requestFingerprint } from "@/modules/security/rate-limit";

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit("group-enquiry", requestFingerprint(request), 8, 3600);
  if (!rateLimit.allowed) return NextResponse.json({ error: "RATE_LIMITED", message: "Too many enquiries. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json") ? await request.json().catch(() => null) : Object.fromEntries(await request.formData());
  const result = groupEnquirySchema.safeParse(raw);
  if (!result.success) return fail("INVALID_ENQUIRY", "Please check the group enquiry", 400, result.error.flatten());
  const reference = `CBG-${new Date().getUTCFullYear()}-${nanoid(7).toUpperCase()}`;
  if (isDatabaseConfigured()) {
    await getDb().insert(groupEnquiries).values({
      reference,
      organisationName: result.data.organisationName,
      groupCategory: result.data.groupCategory,
      destination: result.data.destination,
      checkIn: result.data.checkIn,
      checkOut: result.data.checkOut,
      adults: result.data.adults,
      children: result.data.children,
      requirements: { notes: result.data.requirements ?? "", budgetMinor: result.data.budgetMinor ?? null },
      contact: { name: result.data.contactName, email: result.data.email },
    });
  }
  return NextResponse.json({ data: { reference, status: "NEW_ENQUIRY", submittedAt: new Date().toISOString() }, meta: { persisted: isDatabaseConfigured() } }, { status: 201 });
}
