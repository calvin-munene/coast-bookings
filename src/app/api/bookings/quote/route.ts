import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { bookingQuoteSchema } from "@/modules/bookings/validators";
import { calculateBookingQuote } from "@/modules/bookings/quote-service";

export async function POST(request: Request) {
  const parsed = bookingQuoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_BOOKING_QUOTE", "Booking details are invalid", 400, parsed.error.flatten());
  try {
    return NextResponse.json({ data: await calculateBookingQuote(parsed.data) });
  } catch (error) {
    return fail("QUOTE_UNAVAILABLE", error instanceof Error ? error.message : "The selected stay is unavailable", 409);
  }
}
