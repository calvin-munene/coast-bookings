import { describe, expect, it } from "vitest";
import { groupEnquirySchema } from "@/modules/group-bookings/validators";

const valid = {
  organisationName: "Coast Academy",
  groupCategory: "School",
  destination: "Diani",
  checkIn: "2026-10-12",
  checkOut: "2026-10-16",
  adults: "0",
  children: "40",
  supervisors: "4",
  mealPlan: "FULL_BOARD",
  contactName: "Jane Coordinator",
  email: "jane@example.com",
  contactPhone: "+254 712 345 678",
};

describe("group enquiry validation", () => {
  it("accepts and coerces a detailed school enquiry", () => {
    const result = groupEnquirySchema.parse(valid);
    expect(result.children).toBe(40);
    expect(result.supervisors).toBe(4);
    expect(result.mealPlan).toBe("FULL_BOARD");
  });

  it("rejects an invalid date range", () => {
    expect(() => groupEnquirySchema.parse({ ...valid, checkOut: valid.checkIn })).toThrow("Check-out must be after check-in");
  });

  it("requires at least one traveller and a valid contact number", () => {
    const result = groupEnquirySchema.safeParse({ ...valid, children: "0", supervisors: "0", contactPhone: "123" });
    expect(result.success).toBe(false);
  });
});
