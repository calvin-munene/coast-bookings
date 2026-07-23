import { z } from "zod";

export const createCheckoutSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().min(12).max(128),
});

export type CreateCheckoutSchemaInput = z.infer<typeof createCheckoutSchema>;
