import "dotenv/config";

import { addDays, format } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  amenities,
  destinations,
  featureFlags,
  hostOrganizations,
  hostProfiles,
  inventoryPoolMembers,
  inventoryPools,
  permissions as permissionRecords,
  properties,
  propertyAmenities,
  propertyImages,
  propertyQualityMetrics,
  rolePermissions,
  roles,
  systemSettings,
  unitBeds,
  unitInventoryDays,
  units,
  users,
} from "./schema";
import {
  HOST_PERMISSIONS,
  HOST_ROLE_GRANTS,
  HOST_ROLES,
  INTERNAL_PERMISSIONS,
  INTERNAL_ROLE_GRANTS,
  INTERNAL_ROLES,
  type Permission,
} from "@/modules/authorization/permissions";

const db = getDb();

function permissionDescription(permission: Permission): string {
  return permission.replaceAll(":", " ").replaceAll("-", " ");
}

const destinationSeed = [
  { slug: "diani", name: "Diani", county: "Kwale", description: "White-sand beaches, water sports and relaxed coastal stays.", imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=85", latitude: "-4.2797000", longitude: "39.5942000", featured: true, sortOrder: 1 },
  { slug: "mombasa", name: "Mombasa", county: "Mombasa", description: "Historic old town, city convenience and Indian Ocean beaches.", imageUrl: "https://images.unsplash.com/photo-1619803734358-2b7e6b8f7399?auto=format&fit=crop&w=1200&q=85", latitude: "-4.0435000", longitude: "39.6682000", featured: true, sortOrder: 2 },
  { slug: "watamu", name: "Watamu", county: "Kilifi", description: "Marine parks, coral gardens and intimate boutique stays.", imageUrl: "https://images.unsplash.com/photo-1540202404-a2f29016b523?auto=format&fit=crop&w=1200&q=85", latitude: "-3.3529000", longitude: "40.0209000", featured: true, sortOrder: 3 },
  { slug: "lamu", name: "Lamu", county: "Lamu", description: "Swahili heritage, car-free lanes and timeless island hospitality.", imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85", latitude: "-2.2717000", longitude: "40.9020000", featured: true, sortOrder: 4 },
] as const;

const amenitySeed = [
  { code: "wifi", name: "Wi-Fi", category: "Connectivity" },
  { code: "pool", name: "Swimming pool", category: "Leisure" },
  { code: "beach-access", name: "Beach access", category: "Location" },
  { code: "air-conditioning", name: "Air conditioning", category: "Comfort" },
  { code: "breakfast", name: "Breakfast", category: "Meals" },
  { code: "parking", name: "Parking", category: "Transport" },
  { code: "kitchen", name: "Kitchen", category: "Facilities" },
  { code: "conference", name: "Conference facilities", category: "Business" },
  { code: "accessible", name: "Accessible accommodation", category: "Accessibility" },
  { code: "family-friendly", name: "Family friendly", category: "Suitability" },
  { code: "school-groups", name: "School-group suitable", category: "Suitability" },
] as const;

await db.transaction(async (tx) => {
  await tx.insert(permissionRecords).values(
    [...INTERNAL_PERMISSIONS, ...HOST_PERMISSIONS].map((code) => ({ code, description: permissionDescription(code) })),
  ).onConflictDoNothing();

  await tx.insert(roles).values([
    ...INTERNAL_ROLES.map((code) => ({ code, scope: "INTERNAL" as const, name: code.replace("org:", "").replaceAll("_", " "), permissions: [...INTERNAL_ROLE_GRANTS[code]] })),
    ...HOST_ROLES.map((code) => ({ code, scope: "HOST" as const, name: code.replace("org:", "").replaceAll("_", " "), permissions: [...HOST_ROLE_GRANTS[code]] })),
  ]).onConflictDoNothing();

  const savedPermissions = await tx.select().from(permissionRecords);
  const savedRoles = await tx.select().from(roles);
  const permissionId = new Map(savedPermissions.map((permission) => [permission.code, permission.id]));

  for (const role of savedRoles) {
    const grants = role.scope === "INTERNAL"
      ? INTERNAL_ROLE_GRANTS[role.code as keyof typeof INTERNAL_ROLE_GRANTS]
      : HOST_ROLE_GRANTS[role.code as keyof typeof HOST_ROLE_GRANTS];
    if (!grants) continue;
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await tx.insert(rolePermissions).values(grants.map((code) => ({ roleId: role.id, permissionId: permissionId.get(code)! })));
  }

  await tx.insert(systemSettings).values([
    { key: "booking.request_to_book.host_response_minutes", value: 1440 },
    { key: "booking.request_to_book.payment_minutes", value: 720 },
    { key: "booking.instant.hold_minutes", value: 20 },
    { key: "pricing.guest_service_fee_basis_points", value: 800 },
    { key: "pricing.host_commission_basis_points", value: 1200 },
    { key: "pricing.tax_basis_points", value: 0 },
    { key: "payout.eligibility_hours_after_check_in", value: 24 },
    { key: "payout.automation_enabled", value: false },
    { key: "reviews.double_blind_days", value: 14 },
    { key: "marketplace.currency", value: "KES" },
    { key: "marketplace.indexing_enabled", value: false },
  ]).onConflictDoUpdate({ target: systemSettings.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });

  await tx.insert(featureFlags).values([
    { key: "whop_checkout", enabled: true, rolloutPercentage: 100, description: "Use Whop embedded checkout for online payments." },
    { key: "group_quote_acceptance", enabled: true, rolloutPercentage: 100, description: "Allow secure digital acceptance of group quote options." },
    { key: "shared_wishlists", enabled: false, rolloutPercentage: 0, description: "Enable collaborative trip wishlists after product review." },
    { key: "channel_manager", enabled: false, rolloutPercentage: 0, description: "Enable external OTA channel synchronization after certification." },
    { key: "automated_payouts", enabled: false, rolloutPercentage: 0, description: "Keep payouts manual until finance signs off automation." },
  ]).onConflictDoUpdate({ target: featureFlags.key, set: { description: sql`excluded.description`, updatedAt: new Date() } });

  await tx.insert(destinations).values(destinationSeed.map((item) => ({ ...item }))).onConflictDoUpdate({ target: destinations.slug, set: { name: sql`excluded.name`, county: sql`excluded.county`, description: sql`excluded.description`, imageUrl: sql`excluded.image_url`, latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude`, featured: sql`excluded.featured`, sortOrder: sql`excluded.sort_order`, updatedAt: new Date() } });
  await tx.insert(amenities).values(amenitySeed.map((item) => ({ ...item }))).onConflictDoUpdate({ target: amenities.code, set: { name: sql`excluded.name`, category: sql`excluded.category` } });
});

if (process.env.APP_ENV !== "production" && process.env.SEED_DEMO_DATA === "true") {
  const ids = {
    user: "10000000-0000-4000-8000-000000000001",
    organization: "10000000-0000-4000-8000-000000000002",
    host: "10000000-0000-4000-8000-000000000003",
    property: "10000000-0000-4000-8000-000000000004",
    unit: "10000000-0000-4000-8000-000000000005",
    pool: "10000000-0000-4000-8000-000000000006",
  } as const;
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: ids.user, clerkUserId: "seed:demo-host", primaryEmail: "demo-host@coastbookings.local", fullName: "Coast Bookings Demo Host", phone: "+254700000000", status: "ACTIVE", emailVerified: true, onboardingComplete: true }).onConflictDoNothing();
    await tx.insert(hostOrganizations).values({ id: ids.organization, clerkOrganizationId: "seed:demo-host-organisation", name: "Ocean Breeze Hospitality", slug: "demo-ocean-breeze", status: "VERIFIED", verifiedAt: new Date() }).onConflictDoNothing();
    await tx.insert(hostProfiles).values({ id: ids.host, userId: ids.user, hostOrganizationId: ids.organization, legalName: "Coast Bookings Demo Host", businessName: "Ocean Breeze Hospitality", physicalAddress: "Diani Beach Road, Kwale", verifiedAt: new Date() }).onConflictDoNothing();
    await tx.insert(properties).values({ id: ids.property, hostId: ids.host, hostOrganizationId: ids.organization, name: "Ocean Breeze Guest House", slug: "ocean-breeze-guest-house", description: "A professionally managed coastal guest house close to Diani Beach, with flexible room types, breakfast and attentive local support.", category: "Guest house", address: "Diani Beach Road", destination: "Diani", county: "Kwale", latitude: "-4.2872000", longitude: "39.5948000", checkInInstructions: "Present the Coast Bookings voucher at reception.", houseRules: "Registered guests only. Quiet hours begin at 22:00.", accessibilityFeatures: ["Step-free reception"], safetyFeatures: ["Fire extinguishers", "24-hour security"], nearbyAttractions: ["Diani Beach", "Kongo Mosque"], transportInformation: "Airport transfers can be arranged.", groupSuitability: ["Schools", "Companies", "Sports teams"], mealAvailability: ["Breakfast", "Half board"], status: "PUBLISHED", verifiedAt: new Date(), publishedAt: new Date() }).onConflictDoNothing();
    await tx.insert(units).values({ id: ids.unit, propertyId: ids.property, name: "Standard Double Room", unitType: "Private room", description: "Air-conditioned double room with an ensuite bathroom and breakfast option.", maxAdults: 2, maxChildren: 1, capacity: 3, bedrooms: 1, bathrooms: 1, quantity: 10, baseNightlyRateMinor: 850000n, cleaningFeeMinor: 0n, extraGuestFeeMinor: 150000n, minimumStay: 1, maximumStay: 30, inventoryType: "MULTI_UNIT", bookingMode: "INSTANT", active: true }).onConflictDoNothing();
    await tx.insert(unitBeds).values({ id: "10000000-0000-4000-8000-000000000007", unitId: ids.unit, bedType: "queen bed", quantity: 1 }).onConflictDoNothing();
    await tx.insert(inventoryPools).values({ id: ids.pool, propertyId: ids.property, name: "Standard Double Room inventory", capacity: 10 }).onConflictDoNothing();
    await tx.insert(inventoryPoolMembers).values({ unitId: ids.unit, poolId: ids.pool, quantityConsumed: 1 }).onConflictDoNothing();
    await tx.insert(propertyImages).values({ id: "10000000-0000-4000-8000-000000000008", propertyId: ids.property, storagePath: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85", altText: "Ocean Breeze Guest House pool and gardens", isCover: true }).onConflictDoNothing();
    await tx.insert(propertyQualityMetrics).values({ propertyId: ids.property, completedStays: 124, reviewCount: 87, overallRatingBasisPoints: 472, hostCancellationBasisPoints: 80, coastFavourite: true }).onConflictDoUpdate({ target: propertyQualityMetrics.propertyId, set: { completedStays: 124, reviewCount: 87, overallRatingBasisPoints: 472, coastFavourite: true, calculatedAt: new Date() } });
    const availableAmenities = await tx.select({ id: amenities.id, code: amenities.code }).from(amenities);
    const selectedAmenities = availableAmenities.filter((item) => ["wifi", "pool", "beach-access", "air-conditioning", "breakfast", "parking", "family-friendly", "school-groups"].includes(item.code));
    if (selectedAmenities.length) await tx.insert(propertyAmenities).values(selectedAmenities.map((item) => ({ propertyId: ids.property, amenityId: item.id }))).onConflictDoNothing();
    const inventoryDates = Array.from({ length: 366 }, (_, offset) => ({ poolId: ids.pool, inventoryDate: format(addDays(new Date(), offset), "yyyy-MM-dd"), capacity: 10, held: 0, sold: 0, closed: false, checkInAllowed: true, checkOutAllowed: true }));
    await tx.insert(unitInventoryDays).values(inventoryDates).onConflictDoUpdate({ target: [unitInventoryDays.poolId, unitInventoryDays.inventoryDate], set: { capacity: 10, updatedAt: new Date() } });
  });
  console.log("Seeded opt-in sandbox marketplace property and 366-day inventory calendar.");
}

console.log("Seeded Coast Bookings roles, permissions, settings, feature flags, amenities and destinations.");
