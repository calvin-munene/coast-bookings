"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGuest } from "@/modules/authorization/service";
import { acceptGroupQuote } from "@/modules/group-bookings/quote-acceptance-service";

export async function acceptGroupQuoteAction(formData: FormData): Promise<void> {
  const input = z.object({
    reference: z.string().trim().min(5).max(80),
    optionId: z.string().uuid(),
    token: z.string().min(32).max(256),
    acceptedByName: z.string().trim().min(3).max(160),
    termsAccepted: z.literal("yes"),
  }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await acceptGroupQuote({ ...input, user: context.user, acceptedIp: forwardedFor });
  redirect(`/checkout/group?bookingId=${encodeURIComponent(result.bookingId)}`);
}
