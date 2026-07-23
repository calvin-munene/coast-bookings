import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date");

export const groupEnquirySchema = z.object({
  organisationName: z.string().trim().min(2).max(160),
  groupCategory: z.enum(["School", "Church", "Company", "Sports team", "Tour group"]),
  destination: z.string().trim().min(2).max(120),
  checkIn: dateString,
  checkOut: dateString,
  adults: z.coerce.number().int().min(0).max(500),
  children: z.coerce.number().int().min(0).max(1000),
  supervisors: z.coerce.number().int().min(0).max(500).default(0),
  mealPlan: z.enum(["SELF_CATERING", "ROOM_ONLY", "BED_AND_BREAKFAST", "HALF_BOARD", "FULL_BOARD", "CUSTOM"]),
  roomingPreferences: z.string().trim().max(2000).optional(),
  transportNeeds: z.string().trim().max(2000).optional(),
  conferenceRequirements: z.string().trim().max(2000).optional(),
  accessibilityRequirements: z.string().trim().max(2000).optional(),
  dietaryRequirements: z.string().trim().max(2000).optional(),
  budgetMinor: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  requirements: z.string().trim().max(4000).optional(),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  contactPhone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,19}$/, "Enter a valid telephone number"),
}).superRefine((input, context) => {
  if (input.checkOut <= input.checkIn) context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
  if (input.adults + input.children + input.supervisors < 1) context.addIssue({ code: "custom", path: ["adults"], message: "At least one guest is required" });
});

export type GroupEnquiryInput = z.infer<typeof groupEnquirySchema>;
