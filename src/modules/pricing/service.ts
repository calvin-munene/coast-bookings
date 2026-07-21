import { differenceInCalendarDays, eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { money, percentage, type Money } from "@/modules/shared/money";

export type NightlyRate = Readonly<{ date: string; amountMinor: bigint }>;

export type PricingInput = Readonly<{
  checkIn: string;
  checkOut: string;
  units: number;
  adults: number;
  includedGuests: number;
  nightlyRates: readonly NightlyRate[];
  cleaningFeeMinor: bigint;
  extraGuestFeeMinor: bigint;
  mealFeeMinor: bigint;
  servicesMinor: bigint;
  discountBasisPoints: number;
  guestServiceFeeBasisPoints: number;
  hostCommissionBasisPoints: number;
  taxBasisPoints: number;
}>;

export type PriceItem = Readonly<{
  code: string;
  label: string;
  amount: Money;
  kind: "CHARGE" | "DISCOUNT" | "TAX" | "FEE";
}>;

export type PricingResult = Readonly<{
  nights: number;
  items: readonly PriceItem[];
  guestTotal: Money;
  hostExpectedEarnings: Money;
  commission: Money;
}>;

export function calculatePrice(input: PricingInput): PricingResult {
  const checkIn = parseISO(input.checkIn);
  const checkOut = parseISO(input.checkOut);
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights <= 0) throw new Error("Check-out must be after check-in");
  if (!Number.isInteger(input.units) || input.units < 1) throw new Error("At least one unit is required");

  const stayDates = eachDayOfInterval({ start: checkIn, end: subDays(checkOut, 1) }).map(
    (date) => format(date, "yyyy-MM-dd"),
  );
  const rates = new Map(input.nightlyRates.map((rate) => [rate.date, rate.amountMinor]));
  const accommodationMinor = stayDates.reduce((total, date) => {
    const nightly = rates.get(date);
    if (nightly === undefined) throw new Error(`Missing nightly rate for ${date}`);
    return total + nightly * BigInt(input.units);
  }, 0n);

  const extraGuests = Math.max(0, input.adults - input.includedGuests);
  const extrasMinor = input.extraGuestFeeMinor * BigInt(extraGuests) * BigInt(nights);
  const subtotal = money(
    accommodationMinor +
      input.cleaningFeeMinor +
      extrasMinor +
      input.mealFeeMinor +
      input.servicesMinor,
  );
  const discount = percentage(subtotal, input.discountBasisPoints);
  const discountedSubtotal = money(subtotal.amountMinor - discount.amountMinor);
  const tax = percentage(discountedSubtotal, input.taxBasisPoints);
  const serviceFee = percentage(discountedSubtotal, input.guestServiceFeeBasisPoints);
  const commission = percentage(discountedSubtotal, input.hostCommissionBasisPoints);
  const guestTotal = money(discountedSubtotal.amountMinor + tax.amountMinor + serviceFee.amountMinor);
  const hostExpectedEarnings = money(discountedSubtotal.amountMinor - commission.amountMinor);

  const items: PriceItem[] = [
    { code: "ACCOMMODATION", label: `${nights} night${nights === 1 ? "" : "s"}`, amount: money(accommodationMinor), kind: "CHARGE" },
  ];
  if (input.cleaningFeeMinor > 0n) items.push({ code: "CLEANING", label: "Cleaning fee", amount: money(input.cleaningFeeMinor), kind: "FEE" });
  if (extrasMinor > 0n) items.push({ code: "EXTRA_GUEST", label: "Extra guest charges", amount: money(extrasMinor), kind: "CHARGE" });
  if (input.mealFeeMinor > 0n) items.push({ code: "MEALS", label: "Meal plan", amount: money(input.mealFeeMinor), kind: "CHARGE" });
  if (input.servicesMinor > 0n) items.push({ code: "SERVICES", label: "Additional services", amount: money(input.servicesMinor), kind: "CHARGE" });
  if (discount.amountMinor > 0n) items.push({ code: "DISCOUNT", label: "Discount", amount: discount, kind: "DISCOUNT" });
  if (tax.amountMinor > 0n) items.push({ code: "TAX", label: "Applicable taxes", amount: tax, kind: "TAX" });
  if (serviceFee.amountMinor > 0n) items.push({ code: "SERVICE_FEE", label: "Coast Bookings service fee", amount: serviceFee, kind: "FEE" });

  return { nights, items, guestTotal, hostExpectedEarnings, commission };
}
