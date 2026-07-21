import { z } from "zod";

export const searchSchema = z.object({
  destination: z.string().trim().max(120).default(""),
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  adults: z.coerce.number().int().min(1).max(30).default(2),
  children: z.coerce.number().int().min(0).max(30).default(0),
  rooms: z.coerce.number().int().min(1).max(15).default(1),
  instantBook: z.coerce.boolean().optional(),
  minPriceMinor: z.coerce.number().int().min(0).optional(),
  maxPriceMinor: z.coerce.number().int().min(0).optional(),
});
