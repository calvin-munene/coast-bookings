import { z } from "zod";

const minor = z.coerce.bigint().nonnegative();

export const priceRequestSchema = z.object({
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  units: z.number().int().min(1).max(20),
  adults: z.number().int().min(1).max(100),
  includedGuests: z.number().int().min(1).max(100),
  nightlyRates: z.array(z.object({ date: z.string().date(), amountMinor: minor })).min(1).max(366),
  cleaningFeeMinor: minor.default(0n),
  extraGuestFeeMinor: minor.default(0n),
  mealFeeMinor: minor.default(0n),
  servicesMinor: minor.default(0n),
  discountBasisPoints: z.number().int().min(0).max(10_000).default(0),
  guestServiceFeeBasisPoints: z.number().int().min(0).max(10_000),
  hostCommissionBasisPoints: z.number().int().min(0).max(10_000),
  taxBasisPoints: z.number().int().min(0).max(10_000),
});
