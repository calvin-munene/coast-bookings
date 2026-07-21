import { describe, expect, it } from "vitest";
import { calculatePayout } from "@/modules/payouts/service";

describe("payouts", () => {
  it("stays manual and becomes eligible 24 hours after check-in", () => {
    const result = calculatePayout({ accommodationAndExtrasMinor: 100_000n, hostCommissionMinor: 15_000n, hostTaxWithholdingMinor: 3_000n, refundsChargedToHostMinor: 2_000n, adjustmentsMinor: 500n }, new Date("2026-08-10T12:00:00Z"));
    expect(result.netPayout.amountMinor).toBe(80_500n);
    expect(result.eligibleAt.toISOString()).toBe("2026-08-11T12:00:00.000Z");
    expect(result.requiresManualApproval).toBe(true);
  });
});
