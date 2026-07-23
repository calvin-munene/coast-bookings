import "server-only";

import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { inventoryPoolMembers, promotions, properties, ratePlans, systemSettings, unitInventoryDays, units } from "@/db/schema";
import { calculatePrice } from "@/modules/pricing/service";
import type { BookingQuoteInput } from "./validators";

export type BookingQuote = Readonly<{
  property: Readonly<{ id: string; hostId: string; hostOrganizationId: string; name: string; slug: string }>;
  unit: Readonly<{ id: string; name: string; bookingMode: "INSTANT" | "REQUEST_TO_BOOK" | "GROUP_QUOTE"; available: number }>;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  nights: number;
  currency: "KES";
  items: readonly { code: string; label: string; kind: "CHARGE" | "DISCOUNT" | "TAX" | "FEE"; amountMinor: number }[];
  guestTotalMinor: number;
  hostExpectedEarningsMinor: number;
  commissionMinor: number;
  cancellationPolicy: Readonly<Record<string, unknown>>;
}>;

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : fallback;
}

function safeMinor(value: bigint): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Calculated price is outside the supported range");
  return parsed;
}

export async function calculateBookingQuote(input: BookingQuoteInput): Promise<BookingQuote> {
  const [row] = await getDb().select({ unit: units, property: properties }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(and(eq(units.id, input.unitId), eq(units.active, true), eq(properties.status, "PUBLISHED"))).limit(1);
  if (!row || !row.property.verifiedAt) throw new Error("This unit is not available for public booking");
  const stayDates = eachDayOfInterval({ start: parseISO(input.checkIn), end: subDays(parseISO(input.checkOut), 1) }).map((date) => format(date, "yyyy-MM-dd"));
  if (stayDates.length < row.unit.minimumStay || stayDates.length > row.unit.maximumStay) throw new Error(`Stay must be between ${row.unit.minimumStay} and ${row.unit.maximumStay} nights`);
  if (input.adults > row.unit.maxAdults * input.rooms || input.children > row.unit.maxChildren * input.rooms || input.adults + input.children > row.unit.capacity * input.rooms) throw new Error("Guest count exceeds this unit's capacity");
  if (input.rooms > row.unit.quantity) throw new Error("Requested room quantity is unavailable");

  const [memberCountRow] = await getDb().select({ value: count() }).from(inventoryPoolMembers).where(eq(inventoryPoolMembers.unitId, row.unit.id));
  const expectedPoolCount = memberCountRow?.value ?? 0;
  if (expectedPoolCount < 1) throw new Error("This unit has no bookable inventory pool");
  const inventory = await getDb().select({
    date: unitInventoryDays.inventoryDate,
    poolCount: sql<number>`count(distinct ${inventoryPoolMembers.poolId})::int`,
    available: sql<number>`min(floor((${unitInventoryDays.capacity} - ${unitInventoryDays.held} - ${unitInventoryDays.sold})::numeric / ${inventoryPoolMembers.quantityConsumed}))::int`,
    closed: sql<boolean>`bool_or(${unitInventoryDays.closed})`,
    priceOverrideMinor: sql<bigint | null>`max(${unitInventoryDays.priceOverrideMinor})`,
    minimumStay: sql<number | null>`max(${unitInventoryDays.minimumStay})`,
    maximumStay: sql<number | null>`min(${unitInventoryDays.maximumStay})`,
    checkInAllowed: sql<boolean>`bool_and(${unitInventoryDays.checkInAllowed})`,
  }).from(inventoryPoolMembers).innerJoin(unitInventoryDays, eq(unitInventoryDays.poolId, inventoryPoolMembers.poolId)).where(and(eq(inventoryPoolMembers.unitId, row.unit.id), gte(unitInventoryDays.inventoryDate, input.checkIn), lt(unitInventoryDays.inventoryDate, input.checkOut))).groupBy(unitInventoryDays.inventoryDate);
  const days = new Map(inventory.map((day) => [day.date, day]));
  for (const date of stayDates) {
    const day = days.get(date);
    if (!day || day.poolCount !== expectedPoolCount || day.closed || day.available < input.rooms) throw new Error(`Inventory is unavailable for ${date}`);
  }
  if (days.get(input.checkIn)?.checkInAllowed === false) throw new Error("Check-in is restricted on the selected date");
  const [checkoutDay] = await getDb().select({ allowed: sql<boolean>`bool_and(${unitInventoryDays.checkOutAllowed})`, poolCount: sql<number>`count(distinct ${inventoryPoolMembers.poolId})::int` }).from(inventoryPoolMembers).innerJoin(unitInventoryDays, eq(unitInventoryDays.poolId, inventoryPoolMembers.poolId)).where(and(eq(inventoryPoolMembers.unitId, row.unit.id), eq(unitInventoryDays.inventoryDate, input.checkOut)));
  if (!checkoutDay || checkoutDay.poolCount !== expectedPoolCount || !checkoutDay.allowed) throw new Error("Check-out is restricted for the selected stay");
  const stayMinimum = Math.max(row.unit.minimumStay, ...inventory.map((day) => day.minimumStay ?? 1));
  const stayMaximum = Math.min(row.unit.maximumStay, ...inventory.map((day) => day.maximumStay ?? row.unit.maximumStay));
  if (stayDates.length < stayMinimum || stayDates.length > stayMaximum) throw new Error(`Stay must be between ${stayMinimum} and ${stayMaximum} nights for these dates`);

  const [plans, settings, promotionRows] = await Promise.all([
    getDb().select().from(ratePlans).where(and(eq(ratePlans.unitId, row.unit.id), eq(ratePlans.active, true))),
    getDb().select().from(systemSettings),
    input.promotionCode ? getDb().select().from(promotions).where(and(eq(promotions.code, input.promotionCode.toUpperCase()), eq(promotions.active, true))).limit(1) : Promise.resolve([]),
  ]);
  const setting = new Map(settings.map((item) => [item.key, item.value]));
  const now = new Date();
  const promotion = promotionRows[0];
  const discountBasisPoints = promotion && promotion.startsAt <= now && promotion.endsAt > now && (promotion.usageLimit === null || promotion.usedCount < promotion.usageLimit) ? promotion.discountBasisPoints : 0;
  const nightlyRates = stayDates.map((date) => {
    const inventoryRate = days.get(date)?.priceOverrideMinor;
    if (inventoryRate !== null && inventoryRate !== undefined) return { date, amountMinor: inventoryRate };
    const dayOfWeek = parseISO(date).getDay();
    const plan = plans.filter((candidate) => (!candidate.startsOn || candidate.startsOn <= date) && (!candidate.endsOn || candidate.endsOn >= date) && (candidate.daysOfWeek.length === 0 || candidate.daysOfWeek.includes(dayOfWeek))).sort((a, b) => b.priority - a.priority)[0];
    if (!plan) return { date, amountMinor: row.unit.baseNightlyRateMinor };
    if (plan.amountMinor !== null) return { date, amountMinor: plan.amountMinor };
    return { date, amountMinor: row.unit.baseNightlyRateMinor + row.unit.baseNightlyRateMinor * BigInt(plan.adjustmentBasisPoints ?? 0) / 10_000n };
  });
  const result = calculatePrice({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    units: input.rooms,
    adults: input.adults,
    includedGuests: row.unit.maxAdults * input.rooms,
    nightlyRates,
    cleaningFeeMinor: row.unit.cleaningFeeMinor * BigInt(input.rooms),
    extraGuestFeeMinor: row.unit.extraGuestFeeMinor,
    mealFeeMinor: BigInt(input.mealFeeMinor),
    servicesMinor: BigInt(input.servicesMinor),
    discountBasisPoints,
    guestServiceFeeBasisPoints: numberSetting(setting.get("pricing.guest_service_fee_basis_points"), 800),
    hostCommissionBasisPoints: numberSetting(setting.get("pricing.host_commission_basis_points"), 1200),
    taxBasisPoints: numberSetting(setting.get("pricing.tax_basis_points"), 0),
  });
  return {
    property: { id: row.property.id, hostId: row.property.hostId, hostOrganizationId: row.property.hostOrganizationId, name: row.property.name, slug: row.property.slug },
    unit: { id: row.unit.id, name: row.unit.name, bookingMode: row.unit.bookingMode, available: Math.min(...inventory.map((day) => day.available)) },
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    nights: result.nights,
    currency: "KES",
    items: result.items.map((item) => ({ ...item, amountMinor: safeMinor(item.amount.amountMinor) })),
    guestTotalMinor: safeMinor(result.guestTotal.amountMinor),
    hostExpectedEarningsMinor: safeMinor(result.hostExpectedEarnings.amountMinor),
    commissionMinor: safeMinor(result.commission.amountMinor),
    cancellationPolicy: { code: "MODERATE", freeCancellationHours: 120, serviceFeeRefundable: false, capturedAt: new Date().toISOString() },
  };
}
