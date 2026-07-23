import { z } from "zod";

export const bookingQuoteSchema = z.object({
  unitId: z.string().uuid(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.coerce.number().int().min(1).max(100),
  children: z.coerce.number().int().min(0).max(100).default(0),
  rooms: z.coerce.number().int().min(1).max(30).default(1),
  promotionCode: z.string().trim().max(50).optional(),
  mealFeeMinor: z.coerce.number().int().min(0).max(100_000_000).default(0),
  servicesMinor: z.coerce.number().int().min(0).max(100_000_000).default(0),
}).superRefine((value, context) => {
  if (value.checkOut <= value.checkIn) context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
});

export const createBookingSchema = bookingQuoteSchema.extend({
  guestRequirements: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().min(12).max(128),
});

export const createCheckoutSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().min(12).max(128),
});

export type BookingQuoteInput = z.infer<typeof bookingQuoteSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
