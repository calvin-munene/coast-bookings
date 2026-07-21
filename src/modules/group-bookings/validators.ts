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
  budgetMinor: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  requirements: z.string().trim().max(4000).optional(),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
}).superRefine((input, context) => {
  if (input.checkOut <= input.checkIn) context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
  if (input.adults + input.children < 1) context.addIssue({ code: "custom", path: ["adults"], message: "At least one guest is required" });
});

export type GroupEnquiryInput = z.infer<typeof groupEnquirySchema>;
