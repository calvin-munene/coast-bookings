import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireGuest } from "@/modules/authorization/service";
import { createWhopCheckout } from "@/modules/payments/service";
import { createCheckoutSchema } from "@/modules/payments/validators";

export async function POST(request: Request) {
  const parsed = createCheckoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_CHECKOUT", "Checkout request is invalid", 400, parsed.error.flatten());
  try {
    const context = await requireGuest();
    const session = await createWhopCheckout(context.user.id, parsed.data);
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be created";
    const conflict = /expired|ready|available|hold/i.test(message);
    return fail(conflict ? "CHECKOUT_CONFLICT" : "CHECKOUT_FAILED", message, conflict ? 409 : 500);
  }
}
