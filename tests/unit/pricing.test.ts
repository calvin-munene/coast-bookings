import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/modules/pricing/service";

describe("pricing snapshot", () => {
  it("calculates nightly rates, fees, tax, commission and guest total", () => {
    const result = calculatePrice({
      checkIn: "2026-08-01", checkOut: "2026-08-03", units: 1, adults: 3, includedGuests: 2,
      nightlyRates: [{ date: "2026-08-01", amountMinor: 1_000_00n }, { date: "2026-08-02", amountMinor: 1_200_00n }],
      cleaningFeeMinor: 20_000n, extraGuestFeeMinor: 10_000n, mealFeeMinor: 0n, servicesMinor: 0n,
      discountBasisPoints: 1_000, guestServiceFeeBasisPoints: 500, hostCommissionBasisPoints: 1_500, taxBasisPoints: 1_600,
    });
    expect(result.nights).toBe(2);
    expect(result.guestTotal.amountMinor).toBe(283_140n);
    expect(result.commission.amountMinor).toBe(35_100n);
    expect(result.hostExpectedEarnings.amountMinor).toBe(198_900n);
  });

  it("requires a rate for every occupied night", () => expect(() => calculatePrice({
    checkIn: "2026-08-01", checkOut: "2026-08-03", units: 1, adults: 1, includedGuests: 1,
    nightlyRates: [{ date: "2026-08-01", amountMinor: 100n }], cleaningFeeMinor: 0n, extraGuestFeeMinor: 0n,
    mealFeeMinor: 0n, servicesMinor: 0n, discountBasisPoints: 0, guestServiceFeeBasisPoints: 0, hostCommissionBasisPoints: 0, taxBasisPoints: 0,
  })).toThrow("Missing nightly rate"));
});
