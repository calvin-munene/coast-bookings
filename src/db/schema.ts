import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userStatusEnum = pgEnum("user_status", ["PENDING", "ACTIVE", "RESTRICTED", "SUSPENDED", "DELETED"]);
export const organizationTypeEnum = pgEnum("organization_type", ["HOST", "INTERNAL"]);
export const membershipStatusEnum = pgEnum("membership_status", ["PENDING", "ACTIVE", "EXPIRED", "REVOKED"]);
export const propertyStatusEnum = pgEnum("property_status", [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "VERIFIED",
  "PUBLISHED", "SUSPENDED", "REJECTED", "ARCHIVED",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "DRAFT", "PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "CONFIRMED",
  "HOST_DECLINED", "PAYMENT_FAILED", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST",
  "CANCELLED_BY_ADMIN", "CHECKED_IN", "CHECKED_OUT", "COMPLETED", "NO_SHOW",
  "DISPUTED", "REFUNDED", "PARTIALLY_REFUNDED", "PAYMENT_REVIEW",
]);
export const bookingModeEnum = pgEnum("booking_mode", ["INSTANT", "REQUEST_TO_BOOK", "GROUP_QUOTE"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PROCESSING", "PARTIALLY_PAID", "SUCCEEDED", "FAILED", "DISPUTED", "REFUNDED", "PARTIALLY_REFUNDED"]);
export const payoutStatusEnum = pgEnum("payout_status", ["NOT_ELIGIBLE", "PENDING", "ON_HOLD", "APPROVED", "PROCESSING", "PAID", "FAILED", "REVERSED"]);
export const documentStatusEnum = pgEnum("document_status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "REUPLOAD_REQUESTED"]);
export const groupStatusEnum = pgEnum("group_enquiry_status", ["NEW_ENQUIRY", "REQUIREMENTS_CONFIRMED", "SOURCING_PROPERTIES", "AWAITING_HOST_RESPONSES", "PREPARING_QUOTE", "QUOTE_SENT", "NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED_TO_BOOKING"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]);
export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED", "READ"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  primaryEmail: text("primary_email").notNull(),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  nationality: text("nationality"),
  timezone: text("timezone").default("Africa/Nairobi").notNull(),
  status: userStatusEnum("status").default("PENDING").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
  uniqueIndex("users_primary_email_unique").on(table.primaryEmail),
  index("users_status_idx").on(table.status),
]);

export const guestProfiles = pgTable("guest_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  marketingConsent: boolean("marketing_consent").default(false).notNull(),
  emergencyContact: jsonb("emergency_contact").$type<Record<string, string>>(),
  ...timestamps(),
}, (table) => [uniqueIndex("guest_profiles_user_unique").on(table.userId)]);

export const hostOrganizations = pgTable("host_organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrganizationId: text("clerk_organization_id").notNull(),
  type: organizationTypeEnum("type").default("HOST").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").default("PENDING_VERIFICATION").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("host_organizations_clerk_unique").on(table.clerkOrganizationId),
  uniqueIndex("host_organizations_slug_unique").on(table.slug),
]);

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkMembershipId: text("clerk_membership_id").notNull(),
  organizationId: uuid("organization_id").references(() => hostOrganizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleKey: text("role_key").notNull(),
  status: membershipStatusEnum("status").default("ACTIVE").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  uniqueIndex("organization_memberships_clerk_unique").on(table.clerkMembershipId),
  uniqueIndex("organization_memberships_user_org_unique").on(table.userId, table.organizationId),
  index("organization_memberships_scope_idx").on(table.organizationId, table.status),
]);

export const staffProfiles = pgTable("staff_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  employeeReference: text("employee_reference"),
  department: text("department"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("staff_profiles_user_unique").on(table.userId)]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  scope: organizationTypeEnum("scope").notNull(),
  name: text("name").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("roles_code_scope_unique").on(table.code, table.scope)]);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("permissions_code_unique").on(table.code)]);

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const userRoleAssignments = pgTable("user_role_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  organizationId: uuid("organization_id").references(() => hostOrganizations.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_role_assignments_scope_unique").on(table.userId, table.roleId, table.organizationId),
  index("user_role_assignments_user_idx").on(table.userId),
]);

export const hostProfiles = pgTable("host_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id, { onDelete: "cascade" }).notNull(),
  legalName: text("legal_name").notNull(),
  businessName: text("business_name"),
  businessRegistrationNumber: text("business_registration_number"),
  kraPinEncrypted: text("kra_pin_encrypted"),
  physicalAddress: text("physical_address"),
  emergencyContact: jsonb("emergency_contact").$type<Record<string, string>>(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("host_profiles_user_unique").on(table.userId),
  uniqueIndex("host_profiles_organization_unique").on(table.hostOrganizationId),
]);

export const hostDocuments = pgTable("host_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => hostProfiles.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(),
  storedFileId: uuid("stored_file_id"),
  storagePath: text("storage_path").notNull(),
  checksum: text("checksum").notNull(),
  status: documentStatusEnum("status").default("PENDING").notNull(),
  expiresOn: date("expires_on"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [index("host_documents_host_idx").on(table.hostId)]);

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  address: text("address").notNull(),
  destination: text("destination").notNull(),
  county: text("county").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  checkInFrom: text("check_in_from").default("14:00").notNull(),
  checkOutBy: text("check_out_by").default("10:00").notNull(),
  checkInInstructions: text("check_in_instructions"),
  houseRules: text("house_rules"),
  contactInformation: jsonb("contact_information").$type<Record<string, string>>(),
  accessibilityFeatures: jsonb("accessibility_features").$type<string[]>().default([]).notNull(),
  safetyFeatures: jsonb("safety_features").$type<string[]>().default([]).notNull(),
  nearbyAttractions: jsonb("nearby_attractions").$type<string[]>().default([]).notNull(),
  transportInformation: text("transport_information"),
  groupSuitability: jsonb("group_suitability").$type<string[]>().default([]).notNull(),
  mealAvailability: jsonb("meal_availability").$type<string[]>().default([]).notNull(),
  status: propertyStatusEnum("status").default("DRAFT").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("properties_slug_unique").on(table.slug),
  index("properties_search_idx").on(table.destination, table.status),
]);

export const propertyStaff = pgTable("property_staff", {
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  invitedBy: uuid("invited_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.propertyId, table.userId] })]);

export const propertyDocuments = pgTable("property_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(),
  storedFileId: uuid("stored_file_id"),
  storagePath: text("storage_path").notNull(),
  status: documentStatusEnum("status").default("PENDING").notNull(),
  expiresOn: date("expires_on"),
  notes: text("notes"),
  ...timestamps(),
});

export const propertyImages = pgTable("property_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  storedFileId: uuid("stored_file_id"),
  storagePath: text("storage_path").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isCover: boolean("is_cover").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const propertyVideos = pgTable("property_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  storagePath: text("storage_path").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const amenities = pgTable("amenities", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
}, (table) => [uniqueIndex("amenities_code_unique").on(table.code)]);

export const propertyAmenities = pgTable("property_amenities", {
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  amenityId: uuid("amenity_id").references(() => amenities.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.propertyId, table.amenityId] })]);

export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  unitType: text("unit_type").notNull(),
  description: text("description").notNull(),
  maxAdults: integer("max_adults").notNull(),
  maxChildren: integer("max_children").default(0).notNull(),
  capacity: integer("capacity").notNull(),
  bedrooms: integer("bedrooms").default(1).notNull(),
  bathrooms: integer("bathrooms").default(1).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  baseNightlyRateMinor: bigint("base_nightly_rate_minor", { mode: "bigint" }).notNull(),
  cleaningFeeMinor: bigint("cleaning_fee_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  extraGuestFeeMinor: bigint("extra_guest_fee_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  minimumStay: integer("minimum_stay").default(1).notNull(),
  maximumStay: integer("maximum_stay").default(90).notNull(),
  inventoryType: text("inventory_type").default("MULTI_UNIT").notNull(),
  bookingMode: bookingModeEnum("booking_mode").default("REQUEST_TO_BOOK").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
}, (table) => [
  index("units_property_idx").on(table.propertyId),
  check("units_capacity_positive", sql`${table.capacity} > 0 and ${table.quantity} > 0`),
]);

export const unitBeds = pgTable("unit_beds", {
  id: uuid("id").defaultRandom().primaryKey(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  bedType: text("bed_type").notNull(),
  quantity: integer("quantity").default(1).notNull(),
});

export const unitImages = pgTable("unit_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  storedFileId: uuid("stored_file_id"),
  storagePath: text("storage_path").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const destinations = pgTable("destinations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  county: text("county").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  featured: boolean("featured").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("destinations_slug_unique").on(table.slug),
  index("destinations_featured_idx").on(table.featured, table.sortOrder),
]);

export const inventoryPools = pgTable("inventory_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  ...timestamps(),
}, (table) => [check("inventory_pools_capacity_positive", sql`${table.capacity} > 0`)]);

export const inventoryPoolMembers = pgTable("inventory_pool_members", {
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  poolId: uuid("pool_id").references(() => inventoryPools.id, { onDelete: "cascade" }).notNull(),
  quantityConsumed: integer("quantity_consumed").default(1).notNull(),
}, (table) => [
  primaryKey({ columns: [table.unitId, table.poolId] }),
  check("inventory_pool_members_quantity_positive", sql`${table.quantityConsumed} > 0`),
]);

export const unitInventoryDays = pgTable("unit_inventory_days", {
  poolId: uuid("pool_id").references(() => inventoryPools.id, { onDelete: "cascade" }).notNull(),
  inventoryDate: date("inventory_date").notNull(),
  capacity: integer("capacity").notNull(),
  held: integer("held").default(0).notNull(),
  sold: integer("sold").default(0).notNull(),
  closed: boolean("closed").default(false).notNull(),
  priceOverrideMinor: bigint("price_override_minor", { mode: "bigint" }),
  minimumStay: integer("minimum_stay"),
  maximumStay: integer("maximum_stay"),
  checkInAllowed: boolean("check_in_allowed").default(true).notNull(),
  checkOutAllowed: boolean("check_out_allowed").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.poolId, table.inventoryDate] }),
  check("inventory_day_capacity_check", sql`${table.held} >= 0 and ${table.sold} >= 0 and ${table.held} + ${table.sold} <= ${table.capacity}`),
]);

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  rateType: text("rate_type").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  daysOfWeek: jsonb("days_of_week").$type<number[]>().default([]).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }),
  adjustmentBasisPoints: integer("adjustment_basis_points"),
  priority: integer("priority").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
});

export const promotions = pgTable("promotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
  code: text("code"),
  name: text("name").notNull(),
  discountBasisPoints: integer("discount_basis_points").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("promotions_code_unique").on(table.code)]);

export const inventoryHolds = pgTable("inventory_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  holdType: text("hold_type").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("inventory_holds_idempotency_unique").on(table.idempotencyKey)]);

export const holdItems = pgTable("inventory_hold_items", {
  holdId: uuid("hold_id").references(() => inventoryHolds.id, { onDelete: "cascade" }).notNull(),
  poolId: uuid("pool_id").references(() => inventoryPools.id).notNull(),
  inventoryDate: date("inventory_date").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => [
  primaryKey({ columns: [table.holdId, table.poolId, table.inventoryDate] }),
  check("hold_items_quantity_positive", sql`${table.quantity} > 0`),
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  guestUserId: uuid("guest_user_id").references(() => users.id).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
  holdId: uuid("hold_id").references(() => inventoryHolds.id),
  bookingMode: bookingModeEnum("booking_mode").notNull(),
  status: bookingStatusEnum("status").default("DRAFT").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("PENDING").notNull(),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  adults: integer("adults").notNull(),
  children: integer("children").default(0).notNull(),
  guestRequirements: text("guest_requirements"),
  arrivalDetails: jsonb("arrival_details").$type<Record<string, unknown>>(),
  cancellationPolicySnapshot: jsonb("cancellation_policy_snapshot").$type<Record<string, unknown>>().notNull(),
  source: text("source").default("WEB").notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("bookings_reference_unique").on(table.reference),
  index("bookings_guest_idx").on(table.guestUserId, table.status),
  index("bookings_property_idx").on(table.propertyId, table.checkIn),
  check("bookings_dates_check", sql`${table.checkOut} > ${table.checkIn}`),
]);

export const bookingItems = pgTable("booking_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  quantity: integer("quantity").notNull(),
  adults: integer("adults").notNull(),
  children: integer("children").default(0).notNull(),
  totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
}, (table) => [check("booking_items_quantity_positive", sql`${table.quantity} > 0`)]);

export const bookingGuests = pgTable("booking_guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  fullName: text("full_name").notNull(),
  guestType: text("guest_type").default("ADULT").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
});

export const pricingSnapshots = pgTable("pricing_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  currency: text("currency").default("KES").notNull(),
  guestTotalMinor: bigint("guest_total_minor", { mode: "bigint" }).notNull(),
  hostEarningsMinor: bigint("host_earnings_minor", { mode: "bigint" }).notNull(),
  commissionMinor: bigint("commission_minor", { mode: "bigint" }).notNull(),
  inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("pricing_snapshots_booking_unique").on(table.bookingId)]);

export const bookingPriceItems = pgTable("booking_price_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  snapshotId: uuid("snapshot_id").references(() => pricingSnapshots.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  itemDate: date("item_date"),
  kind: text("kind").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const bookingStatusHistory = pgTable("booking_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  fromStatus: bookingStatusEnum("from_status"),
  toStatus: bookingStatusEnum("to_status").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  provider: text("provider").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").default("KES").notNull(),
  method: text("method").notNull(),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  telephone: text("telephone"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  reconciliationStatus: text("reconciliation_status").default("UNRECONCILED").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("payments_reference_unique").on(table.reference),
  uniqueIndex("payments_provider_transaction_unique").on(table.provider, table.providerTransactionId),
]);

export const paymentCheckoutSessions = pgTable("payment_checkout_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").default("WHOP").notNull(),
  providerSessionId: text("provider_session_id").notNull(),
  providerPlanId: text("provider_plan_id"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").default("KES").notNull(),
  status: text("status").default("OPEN").notNull(),
  returnUrl: text("return_url").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string>>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  uniqueIndex("payment_checkout_sessions_provider_unique").on(table.provider, table.providerSessionId),
  index("payment_checkout_sessions_payment_idx").on(table.paymentId, table.status),
  check("payment_checkout_sessions_amount_positive", sql`${table.amountMinor} > 0`),
]);

export const bookingPaymentSchedules = pgTable("booking_payment_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  label: text("label").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").default("PENDING").notNull(),
  paymentId: uuid("payment_id").references(() => payments.id),
  ...timestamps(),
}, (table) => [
  uniqueIndex("booking_payment_schedules_sequence_unique").on(table.bookingId, table.sequence),
  check("booking_payment_schedules_amount_positive", sql`${table.amountMinor} > 0`),
]);

export const bookingChangeRequests = pgTable("booking_change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  requestedBy: uuid("requested_by").references(() => users.id).notNull(),
  requestType: text("request_type").notNull(),
  requestedChanges: jsonb("requested_changes").$type<Record<string, unknown>>().notNull(),
  status: text("status").default("PENDING").notNull(),
  decisionReason: text("decision_reason"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [index("booking_change_requests_booking_idx").on(table.bookingId, table.status)]);

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("payment_events_provider_unique").on(table.provider, table.providerEventId)]);

export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  status: text("status").default("PENDING").notNull(),
  reason: text("reason").notNull(),
  overrideReason: text("override_reason"),
  approvedBy: uuid("approved_by").references(() => users.id),
  providerReference: text("provider_reference"),
  ...timestamps(),
});

export const ledgerJournals = pgTable("ledger_journals", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  eventType: text("event_type").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  paymentId: uuid("payment_id").references(() => payments.id),
  reversalOfId: uuid("reversal_of_id"),
  description: text("description").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("ledger_journals_reference_unique").on(table.reference)]);

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  journalId: uuid("journal_id").references(() => ledgerJournals.id).notNull(),
  accountCode: text("account_code").notNull(),
  debitMinor: bigint("debit_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  creditMinor: bigint("credit_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  currency: text("currency").default("KES").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("ledger_entries_one_side", sql`(${table.debitMinor} = 0 and ${table.creditMinor} > 0) or (${table.creditMinor} = 0 and ${table.debitMinor} > 0)`)]);

export const payoutAccounts = pgTable("payout_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id).notNull(),
  accountType: text("account_type").notNull(),
  detailsEncrypted: text("details_encrypted").notNull(),
  keyVersion: text("key_version").notNull(),
  status: text("status").default("PENDING_APPROVAL").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id).notNull(),
  payoutAccountId: uuid("payout_account_id").references(() => payoutAccounts.id).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  status: payoutStatusEnum("status").default("NOT_ELIGIBLE").notNull(),
  eligibleAt: timestamp("eligible_at", { withTimezone: true }).notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  processedBy: uuid("processed_by").references(() => users.id),
  externalReference: text("external_reference"),
  ...timestamps(),
}, (table) => [
  uniqueIndex("payouts_reference_unique").on(table.reference),
  uniqueIndex("payouts_booking_unique").on(table.bookingId),
  uniqueIndex("payouts_external_reference_unique").on(table.externalReference),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  conversationType: text("conversation_type").notNull(),
  subject: text("subject").notNull(),
  ...timestamps(),
});

export const conversationMembers = pgTable("conversation_members", {
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.conversationId, table.userId] })]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id),
  body: text("body").notNull(),
  messageType: text("message_type").default("USER").notNull(),
  attachmentPath: text("attachment_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  storedFileId: uuid("stored_file_id").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  deduplicationKey: text("deduplication_key"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(),
  channel: text("channel").notNull(),
  status: notificationStatusEnum("status").default("PENDING").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  providerReference: text("provider_reference"),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("notifications_deduplication_unique").on(table.deduplicationKey)]);

export const notificationConsents = pgTable("notification_consents", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").notNull(),
  purpose: text("purpose").notNull(),
  granted: boolean("granted").default(false).notNull(),
  source: text("source").default("ACCOUNT").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.channel, table.purpose] })]);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  notificationId: uuid("notification_id").references(() => notifications.id, { onDelete: "cascade" }).notNull(),
  attempt: integer("attempt").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  providerReference: text("provider_reference"),
  errorCode: text("error_code"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("notification_deliveries_attempt_unique").on(table.notificationId, table.attempt)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  guestId: uuid("guest_id").references(() => users.id).notNull(),
  ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
  body: text("body").notNull(),
  status: text("status").default("PENDING").notNull(),
  hostResponse: text("host_response"),
  moderatedBy: uuid("moderated_by").references(() => users.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("reviews_booking_unique").on(table.bookingId)]);

export const hostReviews = pgTable("host_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id).notNull(),
  guestId: uuid("guest_id").references(() => users.id).notNull(),
  ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
  body: text("body").notNull(),
  status: text("status").default("PENDING").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("host_reviews_booking_unique").on(table.bookingId)]);

export const reviewReports = pgTable("review_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
  hostReviewId: uuid("host_review_id").references(() => hostReviews.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("OPEN").notNull(),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolution: text("resolution"),
  ...timestamps(),
}, (table) => [check("review_reports_single_target", sql`num_nonnulls(${table.reviewId}, ${table.hostReviewId}) = 1`)]);

export const propertyQualityMetrics = pgTable("property_quality_metrics", {
  propertyId: uuid("property_id").primaryKey().references(() => properties.id, { onDelete: "cascade" }),
  completedStays: integer("completed_stays").default(0).notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  overallRatingBasisPoints: integer("overall_rating_basis_points").default(0).notNull(),
  hostCancellationBasisPoints: integer("host_cancellation_basis_points").default(0).notNull(),
  unresolvedSafetyIncidents: integer("unresolved_safety_incidents").default(0).notNull(),
  coastFavourite: boolean("coast_favourite").default(false).notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupEnquiries = pgTable("group_enquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  coordinatorId: uuid("coordinator_id").references(() => users.id),
  organisationName: text("organisation_name").notNull(),
  groupCategory: text("group_category").notNull(),
  destination: text("destination").notNull(),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  adults: integer("adults").default(0).notNull(),
  children: integer("children").default(0).notNull(),
  supervisors: integer("supervisors").default(0).notNull(),
  requirements: jsonb("requirements").$type<Record<string, unknown>>().notNull(),
  contact: jsonb("contact").$type<Record<string, string>>().notNull(),
  status: groupStatusEnum("status").default("NEW_ENQUIRY").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  ...timestamps(),
}, (table) => [uniqueIndex("group_enquiries_reference_unique").on(table.reference)]);

export const groupQuotes = pgTable("group_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").references(() => groupEnquiries.id, { onDelete: "cascade" }).notNull(),
  reference: text("reference").notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").default("DRAFT").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptanceTokenHash: text("acceptance_token_hash"),
  acceptedOptionId: uuid("accepted_option_id"),
  acceptedByName: text("accepted_by_name"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedIp: text("accepted_ip"),
  bookingId: uuid("booking_id").references(() => bookings.id),
  ...timestamps(),
}, (table) => [
  uniqueIndex("group_quotes_reference_version_unique").on(table.reference, table.version),
  uniqueIndex("group_quotes_acceptance_token_unique").on(table.acceptanceTokenHash),
  index("group_quotes_enquiry_status_idx").on(table.enquiryId, table.status),
]);

export const groupQuoteOptions = pgTable("group_quote_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").references(() => groupQuotes.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  adults: integer("adults").default(1).notNull(),
  children: integer("children").default(0).notNull(),
  title: text("title").notNull(),
  roomingArrangement: text("rooming_arrangement").notNull(),
  inclusions: jsonb("inclusions").$type<string[]>().default([]).notNull(),
  exclusions: jsonb("exclusions").$type<string[]>().default([]).notNull(),
  totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
  depositMinor: bigint("deposit_minor", { mode: "bigint" }).notNull(),
  balanceDueOn: date("balance_due_on"),
  cancellationPolicy: text("cancellation_policy").notNull(),
  holdId: uuid("hold_id").references(() => inventoryHolds.id),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  check("group_quote_options_quantity_positive", sql`${table.quantity} > 0`),
  check("group_quote_options_guest_counts_valid", sql`${table.adults} >= 0 and ${table.children} >= 0`),
  check("group_quote_options_amounts_valid", sql`${table.totalMinor} > 0 and ${table.depositMinor} >= 0 and ${table.depositMinor} <= ${table.totalMinor}`),
]);

export const groupParticipants = pgTable("group_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").references(() => groupEnquiries.id, { onDelete: "cascade" }).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  fullName: text("full_name").notNull(),
  participantType: text("participant_type").notNull(),
  roomingPreference: text("rooming_preference"),
  dietaryRequirements: text("dietary_requirements"),
  accessibilityRequirements: text("accessibility_requirements"),
  emergencyContact: jsonb("emergency_contact").$type<Record<string, string>>(),
  ...timestamps(),
}, (table) => [index("group_participants_enquiry_idx").on(table.enquiryId)]);

export const groupDocuments = pgTable("group_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").references(() => groupEnquiries.id, { onDelete: "cascade" }).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  documentType: text("document_type").notNull(),
  storedFileId: uuid("stored_file_id").notNull(),
  version: integer("version").default(1).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupPaymentAllocations = pgTable("group_payment_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").references(() => groupEnquiries.id, { onDelete: "cascade" }).notNull(),
  participantId: uuid("participant_id").references(() => groupParticipants.id, { onDelete: "set null" }),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("group_payment_allocations_amount_positive", sql`${table.amountMinor} > 0`)]);

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  category: text("category").notNull(),
  priority: text("priority").default("NORMAL").notNull(),
  status: ticketStatusEnum("status").default("OPEN").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  subject: text("subject").notNull(),
  resolution: text("resolution"),
  ...timestamps(),
}, (table) => [uniqueIndex("support_tickets_reference_unique").on(table.reference)]);

export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  attachmentPath: text("attachment_path"),
  internal: boolean("internal").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const favourites = pgTable("favourites", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.propertyId] })]);

export const wishlists = pgTable("wishlists", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  visibility: text("visibility").default("PRIVATE").notNull(),
  shareTokenHash: text("share_token_hash"),
  ...timestamps(),
}, (table) => [index("wishlists_owner_idx").on(table.ownerUserId, table.updatedAt)]);

export const wishlistMembers = pgTable("wishlist_members", {
  wishlistId: uuid("wishlist_id").references(() => wishlists.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").default("VIEWER").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.wishlistId, table.userId] })]);

export const wishlistItems = pgTable("wishlist_items", {
  wishlistId: uuid("wishlist_id").references(() => wishlists.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  addedBy: uuid("added_by").references(() => users.id).notNull(),
  note: text("note"),
  votes: integer("votes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.wishlistId, table.propertyId] })]);

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull(),
  alertsEnabled: boolean("alerts_enabled").default(false).notNull(),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  ...timestamps(),
});

export const recentlyViewedProperties = pgTable("recently_viewed_properties", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.propertyId] })]);

export const disputes = pgTable("disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  openedBy: uuid("opened_by").references(() => users.id).notNull(),
  category: text("category").notNull(),
  status: text("status").default("OPEN").notNull(),
  summary: text("summary").notNull(),
  resolution: text("resolution"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("disputes_reference_unique").on(table.reference), index("disputes_booking_idx").on(table.bookingId, table.status)]);

export const disputeEvidence = pgTable("dispute_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id").references(() => disputes.id, { onDelete: "cascade" }).notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id).notNull(),
  storedFileId: uuid("stored_file_id"),
  statement: text("statement"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("dispute_evidence_has_content", sql`num_nonnulls(${table.storedFileId}, ${table.statement}) > 0`)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  oldValue: jsonb("old_value").$type<unknown>(),
  newValue: jsonb("new_value").$type<unknown>(),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId), index("audit_logs_actor_idx").on(table.userId, table.createdAt)]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").default("RECEIVED").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("webhook_events_provider_unique").on(table.provider, table.providerEventId)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  requestHash: text("request_hash").notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body").$type<unknown>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("idempotency_scope_key_unique").on(table.scope, table.key)]);

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  deduplicationKey: text("deduplication_key"),
  queueName: text("queue_name").notNull(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").default("PENDING").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("outbox_deduplication_unique").on(table.deduplicationKey),
  index("outbox_pending_idx").on(table.status, table.availableAt),
]);

export const icalConnections = pgTable("ical_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  providerName: text("provider_name").notNull(),
  direction: text("direction").notNull(),
  feedUrlEncrypted: text("feed_url_encrypted"),
  exportTokenHash: text("export_token_hash"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
});

export const channelMappings = pgTable("channel_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalPropertyId: text("external_property_id").notNull(),
  externalUnitId: text("external_unit_id"),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("channel_mappings_external_unique").on(table.provider, table.externalPropertyId, table.externalUnitId)]);

export const channelSyncJobs = pgTable("channel_sync_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id").references(() => icalConnections.id, { onDelete: "cascade" }),
  mappingId: uuid("mapping_id").references(() => channelMappings.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  status: text("status").default("PENDING").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  cursor: text("cursor"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("channel_sync_jobs_pending_idx").on(table.status, table.createdAt)]);

export const channelConflicts = pgTable("channel_conflicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalReference: text("external_reference").notNull(),
  conflictType: text("conflict_type").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  status: text("status").default("OPEN").notNull(),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [index("channel_conflicts_open_idx").on(table.status, table.createdAt)]);

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  version: integer("version").default(1).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  description: text("description").notNull(),
  rolloutPercentage: integer("rollout_percentage").default(0).notNull(),
  configuration: jsonb("configuration").$type<Record<string, unknown>>().default({}).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("feature_flags_rollout_range", sql`${table.rolloutPercentage} between 0 and 100`)]);

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventName: text("event_name").notNull(),
  eventVersion: integer("event_version").default(1).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousId: text("anonymous_id"),
  sessionId: text("session_id"),
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("analytics_events_name_time_idx").on(table.eventName, table.occurredAt)]);

export const referralAttributions = pgTable("referral_attributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerUserId: uuid("referrer_user_id").references(() => users.id),
  referredUserId: uuid("referred_user_id").references(() => users.id),
  code: text("code").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  status: text("status").default("CAPTURED").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("referral_attributions_code_idx").on(table.code)]);

export const rewardLedger = pgTable("reward_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reference: text("reference").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("reward_ledger_reference_unique").on(table.reference), index("reward_ledger_user_idx").on(table.userId, table.createdAt)]);

export const storedFiles = pgTable("stored_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  hostOrganizationId: uuid("host_organization_id").references(() => hostOrganizations.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  bucketScope: text("bucket_scope").notNull(),
  objectKey: text("object_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  checksum: text("checksum").notNull(),
  classification: text("classification").default("PRIVATE").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  uniqueIndex("stored_files_object_key_unique").on(table.objectKey),
  index("stored_files_owner_idx").on(table.ownerUserId, table.classification),
  index("stored_files_organization_idx").on(table.hostOrganizationId, table.classification),
]);

export const fileAccessTokens = pgTable("file_access_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileId: uuid("file_id").references(() => storedFiles.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  audienceUserId: uuid("audience_user_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("file_access_tokens_hash_unique").on(table.tokenHash),
  index("file_access_tokens_expiry_idx").on(table.expiresAt),
]);

export const requestRateLimits = pgTable("request_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  scope: text("scope").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  count: integer("count").default(1).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("request_rate_limits_expiry_idx").on(table.expiresAt)]);

export const internalSchema = pgSchema("internal");
export const auditSchema = pgSchema("audit");

export const internalBookingFinancials = internalSchema.table("booking_financials", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  grossMinor: bigint("gross_minor", { mode: "bigint" }).notNull(),
  taxMinor: bigint("tax_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  serviceFeeMinor: bigint("service_fee_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  commissionMinor: bigint("commission_minor", { mode: "bigint" }).default(sql`0`).notNull(),
  hostNetMinor: bigint("host_net_minor", { mode: "bigint" }).notNull(),
  riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
  internalNotes: text("internal_notes"),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
});

export const internalBookingRiskProfiles = internalSchema.table("booking_risk_profiles", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  flags: jsonb("flags").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps(),
});

export const internalStaffTasks = internalSchema.table("staff_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  title: text("title").notNull(),
  priority: text("priority").default("NORMAL").notNull(),
  status: text("status").default("OPEN").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  ...timestamps(),
});

export const internalHostRiskProfiles = internalSchema.table("host_risk_profiles", {
  hostOrganizationId: uuid("host_organization_id").primaryKey().references(() => hostOrganizations.id, { onDelete: "cascade" }),
  rating: text("rating").default("UNRATED").notNull(),
  flags: jsonb("flags").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps(),
});

export const internalSupportTicketDetails = internalSchema.table("support_ticket_details", {
  ticketId: uuid("ticket_id").primaryKey().references(() => supportTickets.id, { onDelete: "cascade" }),
  internalNotes: text("internal_notes"),
  riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
  decision: text("decision"),
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps(),
});

export const securityEvents = auditSchema.table("security_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  outcome: text("outcome").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});
