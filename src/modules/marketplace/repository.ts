import "server-only";

import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import {
  amenities,
  destinations as destinationRecords,
  propertyAmenities,
  propertyImages,
  propertyQualityMetrics,
  properties,
  ratePlans,
  reviews,
  unitBeds,
  unitInventoryDays,
  units,
  inventoryPoolMembers,
  users,
} from "@/db/schema";
import type { SearchInput } from "@/modules/search/validators";
import { calculatePrice } from "@/modules/pricing/service";
import type { MarketplacePropertyCard, MarketplacePropertyDetails, MarketplaceSearchResult, MarketplaceUnit } from "./types";

const PAGE_SIZE = 24;

function safeMinor(value: bigint | number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("A marketplace price is outside the supported range");
  return parsed;
}

function publicImage(storedFileId: string | null, storagePath: string | null): string | null {
  if (storedFileId) return `/api/files/public/${storedFileId}`;
  return storagePath || null;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const lat1 = radians(aLat);
  const lat2 = radians(bLat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function datesForStay(checkIn?: string, checkOut?: string): readonly string[] {
  if (!checkIn || !checkOut) return [];
  return eachDayOfInterval({ start: parseISO(checkIn), end: subDays(parseISO(checkOut), 1) }).map((date) => format(date, "yyyy-MM-dd"));
}

type UnitRow = typeof units.$inferSelect & Readonly<{ available: number }>;

function rateForDate(unit: UnitRow, date: string, inventoryRate: bigint | null, plans: readonly (typeof ratePlans.$inferSelect)[]): bigint {
  if (inventoryRate !== null) return inventoryRate;
  const day = parseISO(date).getDay();
  const matching = plans
    .filter((plan) => plan.active && (!plan.startsOn || plan.startsOn <= date) && (!plan.endsOn || plan.endsOn >= date) && (plan.daysOfWeek.length === 0 || plan.daysOfWeek.includes(day)))
    .sort((a, b) => b.priority - a.priority);
  const selected = matching[0];
  if (!selected) return unit.baseNightlyRateMinor;
  if (selected.amountMinor !== null) return selected.amountMinor;
  return unit.baseNightlyRateMinor + unit.baseNightlyRateMinor * BigInt(selected.adjustmentBasisPoints ?? 0) / 10_000n;
}

async function loadUnits(propertyIds: readonly string[], input: SearchInput): Promise<Map<string, readonly UnitRow[]>> {
  const result = new Map<string, UnitRow[]>();
  if (propertyIds.length === 0) return result;
  const guestCount = input.adults + input.children;
  const stayDates = datesForStay(input.checkIn, input.checkOut);
  const unitRows = await getDb().select().from(units).where(and(
    inArray(units.propertyId, [...propertyIds]),
    eq(units.active, true),
    gte(units.quantity, input.rooms),
    gte(units.capacity, Math.ceil(guestCount / input.rooms)),
    gte(units.maxAdults, Math.ceil(input.adults / input.rooms)),
    input.bedrooms === undefined ? undefined : gte(units.bedrooms, input.bedrooms),
    input.bathrooms === undefined ? undefined : gte(units.bathrooms, input.bathrooms),
    input.instantBook ? eq(units.bookingMode, "INSTANT") : undefined,
    input.minPriceMinor === undefined ? undefined : gte(units.baseNightlyRateMinor, BigInt(input.minPriceMinor)),
    input.maxPriceMinor === undefined ? undefined : lte(units.baseNightlyRateMinor, BigInt(input.maxPriceMinor)),
  ));

  let availability = new Map<string, number>();
  if (stayDates.length > 0 && unitRows.length > 0) {
    const unitIds = unitRows.map((unit) => unit.id);
    const [members, rows, checkoutRows] = await Promise.all([
      getDb().select({ unitId: inventoryPoolMembers.unitId, value: count() }).from(inventoryPoolMembers).where(inArray(inventoryPoolMembers.unitId, unitIds)).groupBy(inventoryPoolMembers.unitId),
      getDb().select({
        unitId: inventoryPoolMembers.unitId,
        available: sql<number>`min(floor((${unitInventoryDays.capacity} - ${unitInventoryDays.held} - ${unitInventoryDays.sold})::numeric / ${inventoryPoolMembers.quantityConsumed}))::int`,
        days: sql<number>`count(distinct ${unitInventoryDays.inventoryDate})::int`,
        rowCount: count(),
        closedRows: sql<number>`count(*) filter (where ${unitInventoryDays.closed})::int`,
        blockedCheckIns: sql<number>`count(*) filter (where ${unitInventoryDays.inventoryDate} = ${input.checkIn!}::date and not ${unitInventoryDays.checkInAllowed})::int`,
      }).from(inventoryPoolMembers)
        .innerJoin(unitInventoryDays, eq(unitInventoryDays.poolId, inventoryPoolMembers.poolId))
        .where(and(inArray(inventoryPoolMembers.unitId, unitIds), gte(unitInventoryDays.inventoryDate, input.checkIn!), lt(unitInventoryDays.inventoryDate, input.checkOut!)))
        .groupBy(inventoryPoolMembers.unitId),
      getDb().select({
        unitId: inventoryPoolMembers.unitId,
        rowCount: count(),
        blocked: sql<number>`count(*) filter (where not ${unitInventoryDays.checkOutAllowed})::int`,
      }).from(inventoryPoolMembers)
        .innerJoin(unitInventoryDays, eq(unitInventoryDays.poolId, inventoryPoolMembers.poolId))
        .where(and(inArray(inventoryPoolMembers.unitId, unitIds), eq(unitInventoryDays.inventoryDate, input.checkOut!)))
        .groupBy(inventoryPoolMembers.unitId),
    ]);
    const memberCount = new Map(members.map((row) => [row.unitId, row.value]));
    const checkout = new Map(checkoutRows.map((row) => [row.unitId, row]));
    availability = new Map(rows.flatMap((row) => {
      const expectedMembers = memberCount.get(row.unitId) ?? 0;
      const checkoutDay = checkout.get(row.unitId);
      const completeStay = expectedMembers > 0 && row.days === stayDates.length && row.rowCount === expectedMembers * stayDates.length;
      const validCheckout = checkoutDay?.rowCount === expectedMembers && checkoutDay.blocked === 0;
      return completeStay && validCheckout && row.closedRows === 0 && row.blockedCheckIns === 0 ? [[row.unitId, row.available] as const] : [];
    }));
  }

  for (const unit of unitRows) {
    const available = stayDates.length === 0 ? unit.quantity : availability.get(unit.id) ?? 0;
    if (available < input.rooms) continue;
    const values = result.get(unit.propertyId) ?? [];
    values.push({ ...unit, available });
    result.set(unit.propertyId, values);
  }
  return result;
}

async function loadAmenities(propertyIds: readonly string[]): Promise<Map<string, readonly string[]>> {
  const result = new Map<string, string[]>();
  if (propertyIds.length === 0) return result;
  const rows = await getDb().select({ propertyId: propertyAmenities.propertyId, code: amenities.code, name: amenities.name })
    .from(propertyAmenities)
    .innerJoin(amenities, eq(amenities.id, propertyAmenities.amenityId))
    .where(inArray(propertyAmenities.propertyId, [...propertyIds]))
    .orderBy(asc(amenities.name));
  for (const row of rows) result.set(row.propertyId, [...(result.get(row.propertyId) ?? []), row.name]);
  return result;
}

async function loadDisplayTotals(unitMap: Map<string, readonly UnitRow[]>, input: SearchInput): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  const stayDates = datesForStay(input.checkIn, input.checkOut);
  if (stayDates.length === 0) return totals;
  const allUnits = [...unitMap.values()].flat();
  if (allUnits.length === 0) return totals;
  const [days, plans] = await Promise.all([
    getDb().select({ unitId: inventoryPoolMembers.unitId, date: unitInventoryDays.inventoryDate, rate: unitInventoryDays.priceOverrideMinor })
      .from(inventoryPoolMembers)
      .innerJoin(unitInventoryDays, eq(unitInventoryDays.poolId, inventoryPoolMembers.poolId))
      .where(and(inArray(inventoryPoolMembers.unitId, allUnits.map((unit) => unit.id)), gte(unitInventoryDays.inventoryDate, input.checkIn!), lt(unitInventoryDays.inventoryDate, input.checkOut!))),
    getDb().select().from(ratePlans).where(and(inArray(ratePlans.unitId, allUnits.map((unit) => unit.id)), eq(ratePlans.active, true))),
  ]);
  const dayRate = new Map(days.map((day) => [`${day.unitId}:${day.date}`, day.rate]));
  const plansByUnit = new Map<string, (typeof ratePlans.$inferSelect)[]>();
  for (const plan of plans) plansByUnit.set(plan.unitId, [...(plansByUnit.get(plan.unitId) ?? []), plan]);

  for (const [propertyId, propertyUnits] of unitMap) {
    const quotes = propertyUnits.map((unit) => calculatePrice({
      checkIn: input.checkIn!,
      checkOut: input.checkOut!,
      units: input.rooms,
      adults: input.adults,
      includedGuests: unit.maxAdults * input.rooms,
      nightlyRates: stayDates.map((date) => ({ date, amountMinor: rateForDate(unit, date, dayRate.get(`${unit.id}:${date}`) ?? null, plansByUnit.get(unit.id) ?? []) })),
      cleaningFeeMinor: unit.cleaningFeeMinor * BigInt(input.rooms),
      extraGuestFeeMinor: unit.extraGuestFeeMinor,
      mealFeeMinor: 0n,
      servicesMinor: 0n,
      discountBasisPoints: 0,
      guestServiceFeeBasisPoints: 800,
      hostCommissionBasisPoints: 1200,
      taxBasisPoints: 0,
    }).guestTotal.amountMinor);
    totals.set(propertyId, safeMinor(quotes.sort((a, b) => a < b ? -1 : a > b ? 1 : 0)[0]));
  }
  return totals;
}

export async function searchMarketplace(input: SearchInput): Promise<MarketplaceSearchResult> {
  const candidates = await getDb().select({
    id: properties.id,
    slug: properties.slug,
    name: properties.name,
    description: properties.description,
    destination: properties.destination,
    county: properties.county,
    address: properties.address,
    category: properties.category,
    latitude: properties.latitude,
    longitude: properties.longitude,
    storedFileId: propertyImages.storedFileId,
    storagePath: propertyImages.storagePath,
    ratingBasisPoints: propertyQualityMetrics.overallRatingBasisPoints,
    reviewCount: propertyQualityMetrics.reviewCount,
    coastFavourite: propertyQualityMetrics.coastFavourite,
  }).from(properties)
    .leftJoin(propertyImages, and(eq(propertyImages.propertyId, properties.id), eq(propertyImages.isCover, true)))
    .leftJoin(propertyQualityMetrics, eq(propertyQualityMetrics.propertyId, properties.id))
    .where(and(
      eq(properties.status, "PUBLISHED"),
      isNotNull(properties.verifiedAt),
      input.destination ? or(ilike(properties.destination, `%${input.destination}%`), ilike(properties.county, `%${input.destination}%`), ilike(properties.name, `%${input.destination}%`)) : undefined,
      input.propertyTypes.length > 0 ? inArray(properties.category, input.propertyTypes) : undefined,
    ))
    .orderBy(desc(propertyQualityMetrics.coastFavourite), desc(propertyQualityMetrics.overallRatingBasisPoints), asc(properties.name))
    .limit(200);

  const uniqueCandidates = [...new Map(candidates.map((row) => [row.id, row])).values()];
  const ids = uniqueCandidates.map((row) => row.id);
  const [unitMap, amenityMap] = await Promise.all([loadUnits(ids, input), loadAmenities(ids)]);
  const totals = await loadDisplayTotals(unitMap, input);
  let cards: MarketplacePropertyCard[] = uniqueCandidates.flatMap((row) => {
    const propertyUnits = unitMap.get(row.id) ?? [];
    if (propertyUnits.length === 0) return [];
    const propertyAmenities = amenityMap.get(row.id) ?? [];
    if (input.amenities.length > 0 && !input.amenities.every((requested) => propertyAmenities.some((name) => name.toLowerCase() === requested.toLowerCase()))) return [];
    const rating = (row.ratingBasisPoints ?? 0) / 100;
    if (input.minRating !== undefined && rating < input.minRating) return [];
    const latitude = row.latitude === null ? null : Number(row.latitude);
    const longitude = row.longitude === null ? null : Number(row.longitude);
    const distance = input.latitude !== undefined && input.longitude !== undefined && latitude !== null && longitude !== null
      ? distanceKm(input.latitude, input.longitude, latitude, longitude)
      : null;
    if (input.maxDistanceKm !== undefined && (distance === null || distance > input.maxDistanceKm)) return [];
    const lowest = Math.min(...propertyUnits.map((unit) => safeMinor(unit.baseNightlyRateMinor)));
    const availableUnits = Math.max(...propertyUnits.map((unit) => unit.available));
    return [{
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      location: `${row.destination}, ${row.county}`,
      destination: row.destination,
      county: row.county,
      category: row.category,
      latitude,
      longitude,
      imageUrl: publicImage(row.storedFileId, row.storagePath),
      amenities: propertyAmenities,
      rating,
      reviewCount: row.reviewCount ?? 0,
      lowestNightlyRateMinor: lowest,
      displayTotalMinor: totals.get(row.id) ?? null,
      currency: "KES" as const,
      priceUnit: "room / night",
      instantBook: propertyUnits.some((unit) => unit.bookingMode === "INSTANT"),
      verified: true,
      coastFavourite: row.coastFavourite ?? false,
      availableUnits,
      limitedAvailability: availableUnits <= 2,
      distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
    }];
  });

  cards = cards.sort((a, b) => {
    if (input.sort === "price_low") return (a.displayTotalMinor ?? a.lowestNightlyRateMinor) - (b.displayTotalMinor ?? b.lowestNightlyRateMinor);
    if (input.sort === "price_high") return (b.displayTotalMinor ?? b.lowestNightlyRateMinor) - (a.displayTotalMinor ?? a.lowestNightlyRateMinor);
    if (input.sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
    if (input.sort === "distance") return (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE);
    return Number(b.coastFavourite) - Number(a.coastFavourite) || b.rating - a.rating || (a.displayTotalMinor ?? a.lowestNightlyRateMinor) - (b.displayTotalMinor ?? b.lowestNightlyRateMinor);
  });
  const offset = (input.page - 1) * PAGE_SIZE;
  return { properties: cards.slice(offset, offset + PAGE_SIZE), count: cards.length, page: input.page, pageSize: PAGE_SIZE };
}

export async function featuredMarketplaceProperties(limit = 3): Promise<readonly MarketplacePropertyCard[]> {
  const result = await searchMarketplace({
    destination: "", adults: 2, children: 0, rooms: 1, propertyTypes: [], amenities: [], sort: "recommended", view: "list", page: 1,
  });
  return result.properties.slice(0, limit);
}

export async function featuredDestinations(): Promise<readonly { slug: string; name: string; county: string; description: string; imageUrl: string | null; stays: number }[]> {
  const [destinations, propertyCounts] = await Promise.all([
    getDb().select().from(destinationRecords).where(and(eq(destinationRecords.active, true), eq(destinationRecords.featured, true))).orderBy(asc(destinationRecords.sortOrder)),
    getDb().select({ destination: properties.destination, value: count() }).from(properties).where(eq(properties.status, "PUBLISHED")).groupBy(properties.destination),
  ]);
  const counts = new Map(propertyCounts.map((row) => [row.destination.toLowerCase(), row.value]));
  return destinations.map((destination) => ({
    slug: destination.slug,
    name: destination.name,
    county: destination.county,
    description: destination.description,
    imageUrl: destination.imageUrl,
    stays: counts.get(destination.name.toLowerCase()) ?? 0,
  }));
}

export async function getMarketplaceProperty(slug: string): Promise<MarketplacePropertyDetails | null> {
  const [property] = await getDb().select().from(properties).where(and(eq(properties.slug, slug), eq(properties.status, "PUBLISHED"), isNotNull(properties.verifiedAt))).limit(1);
  if (!property) return null;
  const baseInput: SearchInput = { destination: "", adults: 1, children: 0, rooms: 1, propertyTypes: [], amenities: [], sort: "recommended", view: "list", page: 1 };
  const [unitMap, amenityMap, qualityRows, unitRows, bedRows, imageRows, reviewRows] = await Promise.all([
    loadUnits([property.id], baseInput),
    loadAmenities([property.id]),
    getDb().select().from(propertyQualityMetrics).where(eq(propertyQualityMetrics.propertyId, property.id)).limit(1),
    getDb().select().from(units).where(and(eq(units.propertyId, property.id), eq(units.active, true))).orderBy(asc(units.baseNightlyRateMinor)),
    getDb().select({ unitId: unitBeds.unitId, bedType: unitBeds.bedType, quantity: unitBeds.quantity }).from(unitBeds).innerJoin(units, eq(units.id, unitBeds.unitId)).where(eq(units.propertyId, property.id)),
    getDb().select().from(propertyImages).where(eq(propertyImages.propertyId, property.id)).orderBy(asc(propertyImages.sortOrder)),
    getDb().select({ id: reviews.id, body: reviews.body, ratings: reviews.ratings, hostResponse: reviews.hostResponse, publishedAt: reviews.publishedAt, guestName: users.fullName })
      .from(reviews).innerJoin(users, eq(users.id, reviews.guestId)).where(and(eq(reviews.propertyId, property.id), eq(reviews.status, "PUBLISHED"), isNotNull(reviews.publishedAt))).orderBy(desc(reviews.publishedAt)).limit(20),
  ]);
  const quality = qualityRows[0];
  const cover = imageRows.find((image) => image.isCover) ?? imageRows[0];
  const availableUnits = [...(unitMap.get(property.id) ?? [])];
  if (availableUnits.length === 0) return null;
  const card: MarketplacePropertyCard = {
    id: property.id,
    slug: property.slug,
    name: property.name,
    description: property.description,
    location: `${property.destination}, ${property.county}`,
    destination: property.destination,
    county: property.county,
    category: property.category,
    latitude: property.latitude === null ? null : Number(property.latitude),
    longitude: property.longitude === null ? null : Number(property.longitude),
    imageUrl: cover ? publicImage(cover.storedFileId, cover.storagePath) : null,
    amenities: amenityMap.get(property.id) ?? [],
    rating: (quality?.overallRatingBasisPoints ?? 0) / 100,
    reviewCount: quality?.reviewCount ?? 0,
    lowestNightlyRateMinor: Math.min(...availableUnits.map((unit) => safeMinor(unit.baseNightlyRateMinor))),
    displayTotalMinor: null,
    currency: "KES",
    priceUnit: "room / night",
    instantBook: availableUnits.some((unit) => unit.bookingMode === "INSTANT"),
    verified: true,
    coastFavourite: quality?.coastFavourite ?? false,
    availableUnits: Math.max(...availableUnits.map((unit) => unit.available)),
    limitedAvailability: Math.max(...availableUnits.map((unit) => unit.available)) <= 2,
    distanceKm: null,
  };
  const beds = new Map<string, string[]>();
  for (const bed of bedRows) beds.set(bed.unitId, [...(beds.get(bed.unitId) ?? []), `${bed.quantity} ${bed.bedType}`]);
  const detailUnits: MarketplaceUnit[] = unitRows.map((unit) => ({
    id: unit.id, name: unit.name, unitType: unit.unitType, description: unit.description, capacity: unit.capacity,
    maxAdults: unit.maxAdults, maxChildren: unit.maxChildren, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
    beds: beds.get(unit.id) ?? [], quantity: unit.quantity, available: unit.quantity,
    baseNightlyRateMinor: safeMinor(unit.baseNightlyRateMinor), cleaningFeeMinor: safeMinor(unit.cleaningFeeMinor),
    minimumStay: unit.minimumStay, maximumStay: unit.maximumStay, bookingMode: unit.bookingMode,
  }));
  return {
    ...card,
    address: property.address,
    checkInFrom: property.checkInFrom,
    checkOutBy: property.checkOutBy,
    checkInInstructions: property.checkInInstructions,
    houseRules: property.houseRules,
    accessibilityFeatures: property.accessibilityFeatures,
    safetyFeatures: property.safetyFeatures,
    nearbyAttractions: property.nearbyAttractions,
    transportInformation: property.transportInformation,
    groupSuitability: property.groupSuitability,
    mealAvailability: property.mealAvailability,
    images: imageRows.flatMap((image) => {
      const url = publicImage(image.storedFileId, image.storagePath);
      return url ? [{ id: image.id, url, altText: image.altText }] : [];
    }),
    units: detailUnits,
    reviews: reviewRows.map((review) => ({
      id: review.id,
      guestName: review.guestName,
      rating: Number(review.ratings.overall ?? 0),
      body: review.body,
      hostResponse: review.hostResponse,
      publishedAt: review.publishedAt!.toISOString(),
    })),
  };
}
