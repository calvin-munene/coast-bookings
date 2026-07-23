import { z } from "zod";

const csv = z.string().trim().default("").transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean));

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
  propertyTypes: csv,
  amenities: csv,
  bedrooms: z.coerce.number().int().min(0).max(30).optional(),
  bathrooms: z.coerce.number().int().min(0).max(30).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  sort: z.enum(["recommended", "price_low", "price_high", "rating", "distance"]).default("recommended"),
  view: z.enum(["list", "map"]).default("list"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
}).superRefine((value, context) => {
  if ((value.checkIn && !value.checkOut) || (!value.checkIn && value.checkOut)) {
    context.addIssue({ code: "custom", message: "Check-in and check-out must be supplied together", path: ["checkOut"] });
  }
  if (value.checkIn && value.checkOut && value.checkOut <= value.checkIn) {
    context.addIssue({ code: "custom", message: "Check-out must be after check-in", path: ["checkOut"] });
  }
  if (value.minPriceMinor !== undefined && value.maxPriceMinor !== undefined && value.minPriceMinor > value.maxPriceMinor) {
    context.addIssue({ code: "custom", message: "Minimum price cannot exceed maximum price", path: ["minPriceMinor"] });
  }
});

export type SearchInput = z.infer<typeof searchSchema>;
