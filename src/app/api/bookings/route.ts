import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { createBookingSchema } from "@/modules/bookings/validators";
import { createBooking } from "@/modules/bookings/service";
import { requireGuest } from "@/modules/authorization/service";

export async function POST(request: Request) {
  const parsed = createBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_BOOKING", "Booking details are invalid", 400, parsed.error.flatten());
  try {
    const context = await requireGuest();
    const booking = await createBooking(context.user.id, parsed.data);
    return NextResponse.json({ data: booking }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking could not be created";
    const unavailable = /inventory|available|capacity|stay/i.test(message);
    return fail(unavailable ? "INVENTORY_UNAVAILABLE" : "BOOKING_FAILED", message, unavailable ? 409 : 500);
  }
}
