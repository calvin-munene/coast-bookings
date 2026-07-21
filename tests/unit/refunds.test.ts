import { describe, expect, it } from "vitest";
import { calculateRefund } from "@/modules/refunds/service";

describe("refund engine", () => {
  it("conditionally refunds service fees and records an override", () => {
    const result = calculateRefund({ accommodationPaidMinor: 100_000n, serviceFeePaidMinor: 8_000n, providerChargesMinor: 1_000n, refundableAccommodationBasisPoints: 5_000, serviceFeeRefundable: true, guestPenaltyMinor: 2_000n, manualAdjustmentMinor: 500n });
    expect(result.finalRefund.amountMinor).toBe(55_500n);
  });
  it("caps refunds at the amount paid", () => expect(calculateRefund({ accommodationPaidMinor: 100n, serviceFeePaidMinor: 10n, providerChargesMinor: 0n, refundableAccommodationBasisPoints: 10_000, serviceFeeRefundable: true, guestPenaltyMinor: 0n, manualAdjustmentMinor: 1_000n }).finalRefund.amountMinor).toBe(110n));
});
