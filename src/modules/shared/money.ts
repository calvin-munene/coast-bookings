import { z } from "zod";

export const currencySchema = z.literal("KES");

export const moneySchema = z.object({
  amountMinor: z.string().regex(/^\d+$/, "Money must be a non-negative integer string"),
  currency: currencySchema,
});

export type MoneyDto = z.infer<typeof moneySchema>;

export type Money = Readonly<{
  amountMinor: bigint;
  currency: "KES";
}>;

export function money(amountMinor: bigint): Money {
  if (amountMinor < 0n) throw new Error("Money cannot be negative");
  return { amountMinor, currency: "KES" };
}

export function addMoney(...values: Money[]): Money {
  return money(values.reduce((sum, value) => sum + value.amountMinor, 0n));
}

export function percentage(value: Money, basisPoints: number): Money {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error("Basis points must be a non-negative integer");
  }
  return money((value.amountMinor * BigInt(basisPoints) + 5_000n) / 10_000n);
}

export function toMoneyDto(value: Money): MoneyDto {
  return { amountMinor: value.amountMinor.toString(), currency: value.currency };
}
