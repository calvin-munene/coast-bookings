import { describe, expect, it } from "vitest";
import { checkInventory } from "@/modules/inventory/service";

const inventory = [
  { date: "2026-08-01", capacity: 5, held: 1, sold: 2, closed: false },
  { date: "2026-08-02", capacity: 5, held: 0, sold: 5, closed: false },
  { date: "2026-08-03", capacity: 5, held: 0, sold: 0, closed: true },
];

describe("inventory", () => {
  it("returns remaining stock for an available request", () => expect(checkInventory(inventory, { quantity: 2, dates: ["2026-08-01"] })).toEqual({ available: true, remainingByDate: { "2026-08-01": 0 } }));
  it("reports sold-out, closed and missing dates", () => expect(checkInventory(inventory, { quantity: 1, dates: ["2026-08-02", "2026-08-03", "2026-08-04"] })).toEqual({ available: false, unavailableDates: ["2026-08-02", "2026-08-03", "2026-08-04"] }));
});
