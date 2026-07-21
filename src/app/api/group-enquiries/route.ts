import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { fail } from "@/lib/api";
import { groupEnquirySchema } from "@/modules/group-bookings/validators";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json") ? await request.json().catch(() => null) : Object.fromEntries(await request.formData());
  const result = groupEnquirySchema.safeParse(raw);
  if (!result.success) return fail("INVALID_ENQUIRY", "Please check the group enquiry", 400, result.error.flatten());
  const reference = `CBG-${new Date().getUTCFullYear()}-${nanoid(7).toUpperCase()}`;
  return NextResponse.json({ data: { reference, status: "NEW_ENQUIRY", submittedAt: new Date().toISOString() }, meta: { sandbox: true } }, { status: 201 });
}
