import { describe, expect, it } from "vitest";
import { addMoney, money, percentage, toMoneyDto } from "@/modules/shared/money";

describe("money", () => {
  it("uses exact minor units", () => {
    expect(addMoney(money(10_050n), money(2_950n))).toEqual(money(13_000n));
    expect(toMoneyDto(money(6_800_00n))).toEqual({ amountMinor: "680000", currency: "KES" });
  });

  it("rounds basis-point calculations to the nearest minor unit", () => {
    expect(percentage(money(10_005n), 1_500).amountMinor).toBe(1_501n);
  });

  it("rejects negative amounts", () => expect(() => money(-1n)).toThrow("negative"));
});
