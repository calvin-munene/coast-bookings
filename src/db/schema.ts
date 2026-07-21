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

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "DEACTIVATED"]);
export const propertyStatusEnum = pgEnum("property_status", [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "VERIFIED",
  "PUBLISHED", "SUSPENDED", "REJECTED", "ARCHIVED",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "DRAFT", "PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "CONFIRMED",
  "HOST_DECLINED", "PAYMENT_FAILED", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST",
  "CANCELLED_BY_ADMIN", "CHECKED_IN", "CHECKED_OUT", "COMPLETED", "NO_SHOW",
  "DISPUTED", "REFUNDED", "PARTIALLY_REFUNDED",
]);
export const bookingModeEnum = pgEnum("booking_mode", ["INSTANT", "REQUEST_TO_BOOK", "GROUP_QUOTE"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]);
export const payoutStatusEnum = pgEnum("payout_status", ["NOT_ELIGIBLE", "PENDING", "ON_HOLD", "APPROVED", "PROCESSING", "PAID", "FAILED", "REVERSED"]);
export const documentStatusEnum = pgEnum("document_status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "REUPLOAD_REQUESTED"]);
export const groupStatusEnum = pgEnum("group_enquiry_status", ["NEW_ENQUIRY", "REQUIREMENTS_CONFIRMED", "SOURCING_PROPERTIES", "AWAITING_HOST_RESPONSES", "PREPARING_QUOTE", "QUOTE_SENT", "NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED_TO_BOOKING"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]);
export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED", "READ"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  nationality: text("nationality"),
  timezone: text("timezone").default("Africa/Nairobi").notNull(),
  status: userStatusEnum("status").default("ACTIVE").notNull(),
  version: integer("version").default(1).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("profiles_email_unique").on(table.email)]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("roles_code_unique").on(table.code)]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  assignedBy: uuid("assigned_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const hostProfiles = pgTable("host_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  legalName: text("legal_name").notNull(),
  businessName: text("business_name"),
  businessRegistrationNumber: text("business_registration_number"),
  kraPinEncrypted: text("kra_pin_encrypted"),
  physicalAddress: text("physical_address"),
  emergencyContact: jsonb("emergency_contact").$type<Record<string, string>>(),
  riskRating: text("risk_rating").default("UNRATED").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [uniqueIndex("host_profiles_user_unique").on(table.userId)]);

export const hostDocuments = pgTable("host_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => hostProfiles.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(),
  storagePath: text("storage_path").notNull(),
  checksum: text("checksum").notNull(),
  status: documentStatusEnum("status").default("PENDING").notNull(),
  expiresOn: date("expires_on"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [index("host_documents_host_idx").on(table.hostId)]);

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
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
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  invitedBy: uuid("invited_by").references(() => profiles.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.propertyId, table.userId] })]);

export const propertyDocuments = pgTable("property_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(),
  storagePath: text("storage_path").notNull(),
  status: documentStatusEnum("status").default("PENDING").notNull(),
  expiresOn: date("expires_on"),
  notes: text("notes"),
  ...timestamps(),
});

export const propertyImages = pgTable("property_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  storagePath: text("storage_path").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isCover: boolean("is_cover").default(false).notNull(),
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
  userId: uuid("user_id").references(() => profiles.id),
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
  guestId: uuid("guest_id").references(() => profiles.id).notNull(),
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
  riskIndicators: jsonb("risk_indicators").$type<string[]>().default([]).notNull(),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("bookings_reference_unique").on(table.reference),
  index("bookings_guest_idx").on(table.guestId, table.status),
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
  actorId: uuid("actor_id").references(() => profiles.id),
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
  approvedBy: uuid("approved_by").references(() => profiles.id),
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
  createdBy: uuid("created_by").references(() => profiles.id),
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
  accountType: text("account_type").notNull(),
  detailsEncrypted: text("details_encrypted").notNull(),
  keyVersion: text("key_version").notNull(),
  status: text("status").default("PENDING_APPROVAL").notNull(),
  approvedBy: uuid("approved_by").references(() => profiles.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  version: integer("version").default(1).notNull(),
  ...timestamps(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  hostId: uuid("host_id").references(() => hostProfiles.id).notNull(),
  payoutAccountId: uuid("payout_account_id").references(() => payoutAccounts.id).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  status: payoutStatusEnum("status").default("NOT_ELIGIBLE").notNull(),
  eligibleAt: timestamp("eligible_at", { withTimezone: true }).notNull(),
  approvedBy: uuid("approved_by").references(() => profiles.id),
  processedBy: uuid("processed_by").references(() => profiles.id),
  externalReference: text("external_reference"),
  ...timestamps(),
}, (table) => [uniqueIndex("payouts_reference_unique").on(table.reference), uniqueIndex("payouts_booking_unique").on(table.bookingId)]);

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  conversationType: text("conversation_type").notNull(),
  subject: text("subject").notNull(),
  ...timestamps(),
});

export const conversationMembers = pgTable("conversation_members", {
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.conversationId, table.userId] })]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => profiles.id),
  body: text("body").notNull(),
  messageType: text("message_type").default("USER").notNull(),
  attachmentPath: text("attachment_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(),
  channel: text("channel").notNull(),
  status: notificationStatusEnum("status").default("PENDING").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  providerReference: text("provider_reference"),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...timestamps(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  guestId: uuid("guest_id").references(() => profiles.id).notNull(),
  ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
  body: text("body").notNull(),
  status: text("status").default("PENDING").notNull(),
  hostResponse: text("host_response"),
  moderatedBy: uuid("moderated_by").references(() => profiles.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [uniqueIndex("reviews_booking_unique").on(table.bookingId)]);

export const groupEnquiries = pgTable("group_enquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  coordinatorId: uuid("coordinator_id").references(() => profiles.id),
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
  assignedTo: uuid("assigned_to").references(() => profiles.id),
  ...timestamps(),
}, (table) => [uniqueIndex("group_enquiries_reference_unique").on(table.reference)]);

export const groupQuotes = pgTable("group_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").references(() => groupEnquiries.id, { onDelete: "cascade" }).notNull(),
  reference: text("reference").notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").default("DRAFT").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedOptionId: uuid("accepted_option_id"),
  acceptedByName: text("accepted_by_name"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedIp: text("accepted_ip"),
  bookingId: uuid("booking_id").references(() => bookings.id),
  ...timestamps(),
}, (table) => [uniqueIndex("group_quotes_reference_version_unique").on(table.reference, table.version)]);

export const groupQuoteOptions = pgTable("group_quote_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").references(() => groupQuotes.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
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
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(),
  userId: uuid("user_id").references(() => profiles.id).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  category: text("category").notNull(),
  priority: text("priority").default("NORMAL").notNull(),
  status: ticketStatusEnum("status").default("OPEN").notNull(),
  assignedTo: uuid("assigned_to").references(() => profiles.id),
  subject: text("subject").notNull(),
  resolution: text("resolution"),
  internalNotes: text("internal_notes"),
  ...timestamps(),
}, (table) => [uniqueIndex("support_tickets_reference_unique").on(table.reference)]);

export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => profiles.id).notNull(),
  body: text("body").notNull(),
  attachmentPath: text("attachment_path"),
  internal: boolean("internal").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const favourites = pgTable("favourites", {
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.propertyId] })]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id),
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
  actorId: uuid("actor_id").references(() => profiles.id),
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
}, (table) => [index("outbox_pending_idx").on(table.status, table.availableAt)]);

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

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  version: integer("version").default(1).notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
