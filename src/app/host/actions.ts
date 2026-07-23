"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { addDays, addHours, eachDayOfInterval, format } from "date-fns";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { auditLogs, bookingPaymentSchedules, bookings, bookingStatusHistory, conversationMembers, conversations, hostDocuments, hostProfiles, hostReviews, inventoryHolds, inventoryPoolMembers, inventoryPools, messages, outboxEvents, payoutAccounts, promotions, properties, propertyImages, ratePlans, supportTickets, ticketMessages, unitBeds, unitInventoryDays, units } from "@/db/schema";
import { encryptSensitiveJson } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { requireHostPermission, requireRecentReverification } from "@/modules/authorization/service";
import { storeFile } from "@/modules/storage/service";

const optionalNumber = (minimum: number, maximum: number) => z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().min(minimum).max(maximum).optional());

const propertySchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().min(80).max(5000),
  category: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(250),
  destination: z.string().trim().min(2).max(100),
  county: z.string().trim().min(2).max(100),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
});

const unitSchema = z.object({
  propertyId: z.string().uuid(), name: z.string().trim().min(2).max(120), unitType: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(2000), maxAdults: z.coerce.number().int().min(1).max(30), maxChildren: z.coerce.number().int().min(0).max(30),
  capacity: z.coerce.number().int().min(1).max(60), bedrooms: z.coerce.number().int().min(0).max(30), bathrooms: z.coerce.number().int().min(1).max(30),
  quantity: z.coerce.number().int().min(1).max(200), baseNightlyRateMinor: z.coerce.number().int().min(10000).max(100_000_000),
  cleaningFeeMinor: z.coerce.number().int().min(0).max(100_000_000).default(0), minimumStay: z.coerce.number().int().min(1).max(90), maximumStay: z.coerce.number().int().min(1).max(365),
  bookingMode: z.enum(["INSTANT", "REQUEST_TO_BOOK"]), bedType: z.string().trim().min(2).max(80), bedQuantity: z.coerce.number().int().min(1).max(20),
}).refine((value) => value.capacity >= value.maxAdults + value.maxChildren, { message: "Capacity must cover adult and child limits", path: ["capacity"] }).refine((value) => value.maximumStay >= value.minimumStay, { message: "Maximum stay must be at least the minimum stay", path: ["maximumStay"] });

function slugify(value: string): string {
  return `${value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70)}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createHostProperty(formData: FormData): Promise<void> {
  const input = propertySchema.parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:property:manage");
  const [host] = await getDb().select().from(hostProfiles).where(eq(hostProfiles.hostOrganizationId, context.membership.organizationId)).limit(1);
  if (!host) throw new Error("Complete host onboarding before creating a property");
  const [property] = await getDb().insert(properties).values({
    hostId: host.id, hostOrganizationId: context.membership.organizationId, name: input.name, slug: slugify(input.name), description: input.description,
    category: input.category, address: input.address, destination: input.destination, county: input.county,
    latitude: input.latitude?.toString(), longitude: input.longitude?.toString(), status: "DRAFT",
  }).returning({ id: properties.id });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "PROPERTY_CREATED", entityType: "property", entityId: property.id, newValue: input });
  revalidatePath("/host/properties");
}

export async function submitHostProperty(formData: FormData): Promise<void> {
  const propertyId = z.string().uuid().parse(formData.get("propertyId"));
  const context = await requireHostPermission("host:property:manage");
  const [property] = await getDb().select().from(properties).where(and(eq(properties.id, propertyId), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!property || !["DRAFT", "CHANGES_REQUESTED"].includes(property.status)) throw new Error("Property cannot be submitted from its current state");
  const [unitCount] = await getDb().select({ value: sql<number>`count(*)::int` }).from(units).where(and(eq(units.propertyId, propertyId), eq(units.active, true)));
  if (!unitCount || unitCount.value < 1) throw new Error("Add at least one active unit before submission");
  await getDb().transaction(async (tx) => {
    await tx.update(properties).set({ status: "SUBMITTED", updatedAt: new Date(), version: property.version + 1 }).where(and(eq(properties.id, propertyId), eq(properties.version, property.version)));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "PROPERTY_SUBMITTED", entityType: "property", entityId: propertyId, oldValue: { status: property.status }, newValue: { status: "SUBMITTED" } });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "PROPERTY_SUBMITTED", aggregateType: "property", aggregateId: propertyId, payload: { propertyId } });
  });
  revalidatePath("/host/properties");
}

export async function createHostUnit(formData: FormData): Promise<void> {
  const input = unitSchema.parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:property:manage");
  const [property] = await getDb().select().from(properties).where(and(eq(properties.id, input.propertyId), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!property || !["DRAFT", "CHANGES_REQUESTED", "VERIFIED", "PUBLISHED"].includes(property.status)) throw new Error("Property cannot be changed from its current state");
  const dates = eachDayOfInterval({ start: new Date(), end: addDays(new Date(), 365) }).map((date) => format(date, "yyyy-MM-dd"));
  await getDb().transaction(async (tx) => {
    const [unit] = await tx.insert(units).values({ propertyId: property.id, name: input.name, unitType: input.unitType, description: input.description, maxAdults: input.maxAdults, maxChildren: input.maxChildren, capacity: input.capacity, bedrooms: input.bedrooms, bathrooms: input.bathrooms, quantity: input.quantity, baseNightlyRateMinor: BigInt(input.baseNightlyRateMinor), cleaningFeeMinor: BigInt(input.cleaningFeeMinor), minimumStay: input.minimumStay, maximumStay: input.maximumStay, inventoryType: input.quantity === 1 ? "SINGLE_UNIT" : "MULTI_UNIT", bookingMode: input.bookingMode }).returning();
    await tx.insert(unitBeds).values({ unitId: unit.id, bedType: input.bedType, quantity: input.bedQuantity });
    const [pool] = await tx.insert(inventoryPools).values({ propertyId: property.id, name: `${unit.name} inventory`, capacity: unit.quantity }).returning();
    await tx.insert(inventoryPoolMembers).values({ unitId: unit.id, poolId: pool.id, quantityConsumed: 1 });
    await tx.insert(unitInventoryDays).values(dates.map((inventoryDate) => ({ poolId: pool.id, inventoryDate, capacity: unit.quantity })));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "UNIT_CREATED", entityType: "unit", entityId: unit.id, newValue: { propertyId: property.id, name: unit.name, quantity: unit.quantity, bookingMode: unit.bookingMode } });
  });
  revalidatePath("/host/units"); revalidatePath("/host/calendar");
}

export async function updateHostInventoryDay(formData: FormData): Promise<void> {
  const input = z.object({ poolId: z.string().uuid(), inventoryDate: z.string().date(), capacity: z.coerce.number().int().min(0).max(500), priceOverrideMinor: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000_000)]), closed: z.string().optional() }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:calendar:manage");
  const [row] = await getDb().select({ day: unitInventoryDays, property: properties }).from(unitInventoryDays).innerJoin(inventoryPools, eq(inventoryPools.id, unitInventoryDays.poolId)).innerJoin(properties, eq(properties.id, inventoryPools.propertyId)).where(and(eq(unitInventoryDays.poolId, input.poolId), eq(unitInventoryDays.inventoryDate, input.inventoryDate), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!row) throw new Error("Calendar date was not found");
  if (input.capacity < row.day.held + row.day.sold) throw new Error("Capacity cannot be lower than held plus sold inventory");
  await getDb().transaction(async (tx) => {
    await tx.update(unitInventoryDays).set({ capacity: input.capacity, priceOverrideMinor: input.priceOverrideMinor === "" ? null : BigInt(input.priceOverrideMinor), closed: input.closed === "on", version: row.day.version + 1, updatedAt: new Date() }).where(and(eq(unitInventoryDays.poolId, input.poolId), eq(unitInventoryDays.inventoryDate, input.inventoryDate), eq(unitInventoryDays.version, row.day.version)));
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "INVENTORY_UPDATED", entityType: "property", entityId: row.property.id, oldValue: { capacity: row.day.capacity, closed: row.day.closed }, newValue: { capacity: input.capacity, closed: input.closed === "on", priceOverrideMinor: input.priceOverrideMinor } });
  });
  revalidatePath("/host/calendar"); revalidatePath("/host/availability");
}

export async function decideHostBooking(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), decision: z.enum(["ACCEPT", "DECLINE"]), reason: z.string().trim().max(500).default("") }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:reservations:manage");
  const [row] = await getDb().select({ booking: bookings, hold: inventoryHolds }).from(bookings).innerJoin(inventoryHolds, eq(inventoryHolds.id, bookings.holdId)).where(and(eq(bookings.id, input.bookingId), eq(bookings.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!row || row.booking.status !== "PENDING_HOST_APPROVAL" || row.hold.status !== "ACTIVE" || row.hold.expiresAt <= new Date()) throw new Error("Booking request is no longer actionable");
  await getDb().transaction(async (tx) => {
    if (input.decision === "ACCEPT") {
      const paymentDeadline = addHours(new Date(), 12);
      await tx.update(inventoryHolds).set({ expiresAt: paymentDeadline }).where(eq(inventoryHolds.id, row.hold.id));
      await tx.update(bookings).set({ status: "AWAITING_PAYMENT", updatedAt: new Date(), version: row.booking.version + 1 }).where(and(eq(bookings.id, row.booking.id), eq(bookings.version, row.booking.version)));
      await tx.update(bookingPaymentSchedules).set({ dueAt: paymentDeadline, updatedAt: new Date() }).where(eq(bookingPaymentSchedules.bookingId, row.booking.id));
      await tx.insert(bookingStatusHistory).values({ bookingId: row.booking.id, fromStatus: "PENDING_HOST_APPROVAL", toStatus: "AWAITING_PAYMENT", actorId: context.user.id, reason: input.reason || "Host accepted request" });
      await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "HOST_ACCEPTED_BOOKING", aggregateType: "booking", aggregateId: row.booking.id, payload: { bookingId: row.booking.id, paymentDeadline: paymentDeadline.toISOString() } });
    } else {
      await tx.execute(sql`select public.release_inventory_hold(${row.hold.id}::uuid, 'HOST_DECLINED'::text)`);
      await tx.update(bookings).set({ status: "HOST_DECLINED", updatedAt: new Date(), version: row.booking.version + 1 }).where(and(eq(bookings.id, row.booking.id), eq(bookings.version, row.booking.version)));
      await tx.insert(bookingStatusHistory).values({ bookingId: row.booking.id, fromStatus: "PENDING_HOST_APPROVAL", toStatus: "HOST_DECLINED", actorId: context.user.id, reason: input.reason || "Host declined request" });
      await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "HOST_DECLINED_BOOKING", aggregateType: "booking", aggregateId: row.booking.id, payload: { bookingId: row.booking.id } });
    }
    await tx.insert(auditLogs).values({ userId: context.user.id, action: input.decision === "ACCEPT" ? "BOOKING_ACCEPTED" : "BOOKING_DECLINED", entityType: "booking", entityId: row.booking.id, reason: input.reason || null });
  });
  revalidatePath("/host/reservations");
}

export async function uploadHostPropertyImage(formData: FormData): Promise<void> {
  const propertyId = z.string().uuid().parse(formData.get("propertyId"));
  const altText = z.string().trim().min(5).max(240).parse(formData.get("altText"));
  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("Select a property photograph");
  const context = await requireHostPermission("host:property:manage");
  const [property] = await getDb().select({ id: properties.id, slug: properties.slug }).from(properties).where(and(eq(properties.id, propertyId), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!property) throw new Error("Property was not found");
  const stored = await storeFile({ scope: "PUBLIC_PROPERTY_IMAGES", bytes: Buffer.from(await file.arrayBuffer()), originalName: file.name, mimeType: file.type, ownerUserId: context.user.id, hostOrganizationId: context.membership.organizationId });
  await getDb().transaction(async (tx) => {
    const [cover] = await tx.select({ id: propertyImages.id }).from(propertyImages).where(and(eq(propertyImages.propertyId, property.id), eq(propertyImages.isCover, true))).limit(1);
    await tx.insert(propertyImages).values({ propertyId: property.id, storedFileId: stored.id, storagePath: stored.objectKey, altText, isCover: !cover });
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "PROPERTY_IMAGE_UPLOADED", entityType: "property", entityId: property.id, newValue: { fileId: stored.id, altText, cover: !cover } });
  });
  revalidatePath("/host/properties"); revalidatePath(`/stays/${property.slug}`);
}

export async function uploadHostVerificationDocument(formData: FormData): Promise<void> {
  const input = z.object({ documentType: z.string().trim().min(3).max(100), expiresOn: z.union([z.literal(""), z.string().date()]) }).parse(Object.fromEntries(formData));
  const file = formData.get("document");
  if (!(file instanceof File)) throw new Error("Select a verification document");
  const context = await requireHostPermission("host:property:manage");
  const [host] = await getDb().select().from(hostProfiles).where(eq(hostProfiles.hostOrganizationId, context.membership.organizationId)).limit(1);
  if (!host) throw new Error("Complete host onboarding first");
  const stored = await storeFile({ scope: "PRIVATE_HOST_DOCUMENTS", bytes: Buffer.from(await file.arrayBuffer()), originalName: file.name, mimeType: file.type, ownerUserId: context.user.id, hostOrganizationId: context.membership.organizationId });
  await getDb().transaction(async (tx) => {
    const [document] = await tx.insert(hostDocuments).values({ hostId: host.id, documentType: input.documentType, storedFileId: stored.id, storagePath: stored.objectKey, checksum: stored.checksum, expiresOn: input.expiresOn || null, status: "PENDING" }).returning({ id: hostDocuments.id });
    await tx.insert(auditLogs).values({ userId: context.user.id, action: "HOST_DOCUMENT_UPLOADED", entityType: "host_document", entityId: document.id, newValue: { documentType: input.documentType, fileId: stored.id, expiresOn: input.expiresOn || null } });
  });
  revalidatePath("/host/verification");
}

export async function createHostRatePlan(formData: FormData): Promise<void> {
  const input = z.object({ unitId: z.string().uuid(), name: z.string().trim().min(3).max(120), rateType: z.enum(["SEASONAL", "WEEKEND", "HOLIDAY"]), startsOn: z.union([z.literal(""), z.string().date()]), endsOn: z.union([z.literal(""), z.string().date()]), daysOfWeek: z.string().trim().max(30).default(""), amountMinor: z.union([z.literal(""), z.coerce.number().int().min(10000).max(100_000_000)]), adjustmentBasisPoints: z.union([z.literal(""), z.coerce.number().int().min(-9000).max(50_000)]), priority: z.coerce.number().int().min(0).max(100).default(0) }).superRefine((value, context) => {
    if ((value.amountMinor === "") === (value.adjustmentBasisPoints === "")) context.addIssue({ code: "custom", message: "Set either a fixed rate or a percentage adjustment", path: ["amountMinor"] });
    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", message: "End date must not precede start date", path: ["endsOn"] });
  }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:rates:manage");
  const [unit] = await getDb().select({ id: units.id, propertyId: properties.id }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(and(eq(units.id, input.unitId), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!unit) throw new Error("Unit was not found");
  const days = input.daysOfWeek ? input.daysOfWeek.split(",").map((value) => Number(value.trim())) : [];
  if (days.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) throw new Error("Days of week must use comma-separated values from 0 to 6");
  const [plan] = await getDb().insert(ratePlans).values({ unitId: unit.id, name: input.name, rateType: input.rateType, startsOn: input.startsOn || null, endsOn: input.endsOn || null, daysOfWeek: [...new Set(days)], amountMinor: input.amountMinor === "" ? null : BigInt(input.amountMinor), adjustmentBasisPoints: input.adjustmentBasisPoints === "" ? null : input.adjustmentBasisPoints, priority: input.priority, active: true }).returning({ id: ratePlans.id });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "RATE_PLAN_CREATED", entityType: "rate_plan", entityId: plan.id, newValue: { ...input, unitId: unit.id } });
  revalidatePath("/host/rates");
}

export async function createHostPromotion(formData: FormData): Promise<void> {
  const input = z.object({ propertyId: z.string().uuid(), name: z.string().trim().min(3).max(120), code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/), discountPercent: z.coerce.number().min(1).max(80), startsAt: z.string().datetime({ local: true }), endsAt: z.string().datetime({ local: true }), usageLimit: z.union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)]) }).refine((value) => value.endsAt > value.startsAt, { message: "Promotion end must be after its start", path: ["endsAt"] }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:rates:manage");
  const [property] = await getDb().select({ id: properties.id }).from(properties).where(and(eq(properties.id, input.propertyId), eq(properties.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!property) throw new Error("Property was not found");
  const [promotion] = await getDb().insert(promotions).values({ propertyId: property.id, name: input.name, code: input.code.toUpperCase(), discountBasisPoints: Math.round(input.discountPercent * 100), startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), usageLimit: input.usageLimit === "" ? null : input.usageLimit, active: true }).returning({ id: promotions.id });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "PROMOTION_CREATED", entityType: "promotion", entityId: promotion.id, newValue: { propertyId: property.id, code: input.code.toUpperCase(), discountPercent: input.discountPercent } });
  revalidatePath("/host/promotions");
}

export async function recordHostStayEvent(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), event: z.enum(["CHECK_IN", "CHECK_OUT", "NO_SHOW"]), reason: z.string().trim().max(500).default("") }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:reservations:manage");
  const [booking] = await getDb().select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.hostOrganizationId, context.membership.organizationId))).limit(1);
  if (!booking) throw new Error("Booking was not found");
  const next = input.event === "CHECK_IN" ? "CHECKED_IN" as const : input.event === "CHECK_OUT" ? "CHECKED_OUT" as const : "NO_SHOW" as const;
  const allowed = input.event === "CHECK_IN" ? booking.status === "CONFIRMED" : input.event === "CHECK_OUT" ? booking.status === "CHECKED_IN" : ["CONFIRMED", "CHECKED_IN"].includes(booking.status);
  if (!allowed) throw new Error(`Cannot record ${input.event.toLowerCase().replace("_", " ")} from ${booking.status}`);
  await getDb().transaction(async (tx) => {
    await tx.update(bookings).set({ status: next, checkedInAt: input.event === "CHECK_IN" ? new Date() : booking.checkedInAt, checkedOutAt: input.event === "CHECK_OUT" ? new Date() : booking.checkedOutAt, updatedAt: new Date(), version: booking.version + 1 }).where(and(eq(bookings.id, booking.id), eq(bookings.version, booking.version)));
    await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, fromStatus: booking.status, toStatus: next, actorId: context.user.id, reason: input.reason || `Host recorded ${input.event}` });
    await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: `BOOKING_${next}`, aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id, reference: booking.reference } });
  });
  revalidatePath("/host/reservations");
}

export async function sendHostMessage(formData: FormData): Promise<void> {
  const input = z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:messages:manage");
  const [conversation] = await getDb().select({ id: conversations.id, organizationId: bookings.hostOrganizationId }).from(conversations).leftJoin(bookings, eq(bookings.id, conversations.bookingId)).where(eq(conversations.id, input.conversationId)).limit(1);
  const [membership] = await getDb().select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, input.conversationId), eq(conversationMembers.userId, context.user.id))).limit(1);
  if (!conversation || (conversation.organizationId !== context.membership.organizationId && !membership)) throw new Error("Conversation was not found");
  const [message] = await getDb().insert(messages).values({ conversationId: conversation.id, senderId: context.user.id, body: input.body, messageType: "USER" }).returning({ id: messages.id });
  await getDb().insert(outboxEvents).values({ queueName: "notifications", eventType: "MESSAGE_CREATED", aggregateType: "message", aggregateId: message.id, payload: { messageId: message.id, conversationId: conversation.id } });
  revalidatePath("/host/messages");
}

export async function submitHostGuestReview(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), communication: z.coerce.number().int().min(1).max(5), houseRules: z.coerce.number().int().min(1).max(5), body: z.string().trim().min(20).max(3000) }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:reservations:manage");
  const [booking] = await getDb().select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.hostOrganizationId, context.membership.organizationId), inArray(bookings.status, ["CHECKED_OUT", "COMPLETED"]))).limit(1);
  if (!booking) throw new Error("Only completed stays can be reviewed");
  const [review] = await getDb().insert(hostReviews).values({ bookingId: booking.id, hostOrganizationId: context.membership.organizationId, guestId: booking.guestUserId, ratings: { communication: input.communication, houseRules: input.houseRules }, body: input.body, status: "PENDING" }).returning({ id: hostReviews.id });
  await getDb().insert(outboxEvents).values({ queueName: "reviews", eventType: "HOST_REVIEW_SUBMITTED", aggregateType: "host_review", aggregateId: review.id, payload: { reviewId: review.id, bookingId: booking.id } });
  revalidatePath("/host/reviews");
}

export async function inviteHostTeamMember(formData: FormData): Promise<void> {
  const input = z.object({ email: z.string().email(), role: z.enum(["org:property_manager", "org:reservations", "org:front_desk", "org:accountant", "org:viewer"]) }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:staff:manage");
  const clerk = await clerkClient();
  const invitation = await clerk.organizations.createOrganizationInvitation({ organizationId: context.membership.clerkOrganizationId, emailAddress: input.email, role: input.role, inviterUserId: context.clerkUserId, expiresInDays: 14, redirectUrl: new URL("/auth/continue", getEnv().NEXT_PUBLIC_APP_URL).toString() });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "HOST_TEAM_INVITATION_CREATED", entityType: "host_organization", entityId: context.membership.organizationId, newValue: { invitationId: invitation.id, email: input.email, role: input.role } });
  revalidatePath("/host/team");
}

export async function proposeHostPayoutAccount(formData: FormData): Promise<void> {
  const input = z.object({ accountType: z.enum(["MPESA", "BANK"]), accountName: z.string().trim().min(3).max(160), accountReference: z.string().trim().min(5).max(120), bankName: z.string().trim().max(120).default(""), reason: z.string().trim().min(10).max(500) }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:payout-account:manage");
  await requireRecentReverification("strict_mfa");
  const [host] = await getDb().select({ id: hostProfiles.id }).from(hostProfiles).where(eq(hostProfiles.hostOrganizationId, context.membership.organizationId)).limit(1);
  if (!host) throw new Error("Host profile was not found");
  const detailsEncrypted = encryptSensitiveJson({ accountName: input.accountName, accountReference: input.accountReference, bankName: input.bankName });
  const [account] = await getDb().insert(payoutAccounts).values({ hostId: host.id, hostOrganizationId: context.membership.organizationId, accountType: input.accountType, detailsEncrypted, keyVersion: getEnv().APP_ENCRYPTION_KEY_VERSION, status: "PENDING_APPROVAL" }).returning({ id: payoutAccounts.id });
  await getDb().insert(auditLogs).values({ userId: context.user.id, action: "PAYOUT_ACCOUNT_PROPOSED", entityType: "payout_account", entityId: account.id, newValue: { accountType: input.accountType, keyVersion: getEnv().APP_ENCRYPTION_KEY_VERSION }, reason: input.reason });
  revalidatePath("/host/payouts");
}

export async function createHostSupportTicket(formData: FormData): Promise<void> {
  const input = z.object({ category: z.string().trim().min(3).max(100), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), subject: z.string().trim().min(5).max(200), body: z.string().trim().min(10).max(4000) }).parse(Object.fromEntries(formData));
  const context = await requireHostPermission("host:property:view");
  const reference = `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  await getDb().transaction(async (tx) => {
    const [ticket] = await tx.insert(supportTickets).values({ reference, userId: context.user.id, hostOrganizationId: context.membership.organizationId, category: input.category, priority: input.priority, subject: input.subject, status: "OPEN" }).returning({ id: supportTickets.id });
    await tx.insert(ticketMessages).values({ ticketId: ticket.id, senderId: context.user.id, body: input.body, internal: false });
    await tx.insert(outboxEvents).values({ queueName: "operations", eventType: "SUPPORT_TICKET_CREATED", aggregateType: "support_ticket", aggregateId: ticket.id, payload: { ticketId: ticket.id } });
  });
  revalidatePath("/host/support");
}
