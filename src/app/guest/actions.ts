"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { bookingChangeRequests, bookings, bookingStatusHistory, conversationMembers, guestProfiles, messages, notificationConsents, outboxEvents, properties, reviews, savedSearches, supportTickets, ticketMessages, wishlistItems, wishlistMembers, wishlists } from "@/db/schema";
import { requireGuest } from "@/modules/authorization/service";

export async function requestGuestCancellation(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const [booking] = await getDb().select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.guestUserId, context.user.id))).limit(1);
  if (!booking) throw new Error("Booking was not found");
  if (["DRAFT", "PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(booking.status)) {
    await getDb().transaction(async (tx) => {
      if (booking.holdId) await tx.execute(sql`select public.release_inventory_hold(${booking.holdId}::uuid, 'GUEST_CANCELLED'::text)`);
      await tx.update(bookings).set({ status: "CANCELLED_BY_GUEST", updatedAt: new Date(), version: booking.version + 1 }).where(and(eq(bookings.id, booking.id), eq(bookings.version, booking.version)));
      await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, fromStatus: booking.status, toStatus: "CANCELLED_BY_GUEST", actorId: context.user.id, reason: input.reason });
      await tx.insert(outboxEvents).values({ queueName: "notifications", eventType: "BOOKING_CANCELLED_BY_GUEST", aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id } });
    });
  } else if (["CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
    const [change] = await getDb().insert(bookingChangeRequests).values({ bookingId: booking.id, requestedBy: context.user.id, requestType: "CANCELLATION", requestedChanges: { reason: input.reason }, status: "PENDING" }).returning();
    await getDb().insert(outboxEvents).values({ queueName: "operations", eventType: "CANCELLATION_REVIEW_REQUIRED", aggregateType: "booking_change_request", aggregateId: change.id, payload: { bookingId: booking.id, changeRequestId: change.id } });
  } else throw new Error("Booking cannot be cancelled from its current state");
  revalidatePath("/guest/upcoming-stays"); revalidatePath("/guest/pending-requests");
}

export async function sendGuestMessage(formData: FormData): Promise<void> {
  const input = z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const [membership] = await getDb().select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, input.conversationId), eq(conversationMembers.userId, context.user.id))).limit(1);
  if (!membership) throw new Error("Conversation was not found");
  const [message] = await getDb().insert(messages).values({ conversationId: input.conversationId, senderId: context.user.id, body: input.body, messageType: "USER" }).returning();
  await getDb().insert(outboxEvents).values({ queueName: "notifications", eventType: "MESSAGE_CREATED", aggregateType: "message", aggregateId: message.id, payload: { messageId: message.id, conversationId: input.conversationId } });
  revalidatePath("/guest/messages");
}

export async function submitGuestReview(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), overall: z.coerce.number().int().min(1).max(5), accuracy: z.coerce.number().int().min(1).max(5), cleanliness: z.coerce.number().int().min(1).max(5), communication: z.coerce.number().int().min(1).max(5), location: z.coerce.number().int().min(1).max(5), checkIn: z.coerce.number().int().min(1).max(5), amenities: z.coerce.number().int().min(1).max(5), value: z.coerce.number().int().min(1).max(5), body: z.string().trim().min(20).max(3000) }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const [booking] = await getDb().select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.guestUserId, context.user.id), inArray(bookings.status, ["CHECKED_OUT", "COMPLETED"]))).limit(1);
  if (!booking) throw new Error("Only completed stays can be reviewed");
  await getDb().transaction(async (tx) => {
    const [review] = await tx.insert(reviews).values({ bookingId: booking.id, propertyId: booking.propertyId, guestId: context.user.id, ratings: { overall: input.overall, accuracy: input.accuracy, cleanliness: input.cleanliness, communication: input.communication, location: input.location, checkIn: input.checkIn, amenities: input.amenities, value: input.value }, body: input.body, status: "PENDING" }).returning();
    await tx.insert(outboxEvents).values({ queueName: "reviews", eventType: "REVIEW_SUBMITTED", aggregateType: "review", aggregateId: review.id, payload: { reviewId: review.id, bookingId: booking.id } });
  });
  revalidatePath("/guest/reviews");
}

export async function createGuestSupportTicket(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.union([z.literal(""), z.string().uuid()]), category: z.string().trim().min(3).max(100), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), subject: z.string().trim().min(5).max(200), body: z.string().trim().min(10).max(4000) }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  if (input.bookingId) {
    const [booking] = await getDb().select({ id: bookings.id }).from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.guestUserId, context.user.id))).limit(1);
    if (!booking) throw new Error("Booking was not found");
  }
  const reference = `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  await getDb().transaction(async (tx) => {
    const [ticket] = await tx.insert(supportTickets).values({ reference, userId: context.user.id, bookingId: input.bookingId || null, category: input.category, priority: input.priority, subject: input.subject, status: "OPEN", resolution: null }).returning();
    await tx.insert(ticketMessages).values({ ticketId: ticket.id, senderId: context.user.id, body: input.body, internal: false });
    await tx.insert(outboxEvents).values({ queueName: "operations", eventType: "SUPPORT_TICKET_CREATED", aggregateType: "support_ticket", aggregateId: ticket.id, payload: { ticketId: ticket.id } });
  });
  revalidatePath("/guest/dashboard");
}

export async function requestGuestDateChange(formData: FormData): Promise<void> {
  const input = z.object({ bookingId: z.string().uuid(), checkIn: z.string().date(), checkOut: z.string().date(), reason: z.string().trim().min(10).max(1000) }).refine((value) => value.checkOut > value.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const [booking] = await getDb().select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.guestUserId, context.user.id), inArray(bookings.status, ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "CONFIRMED"]))).limit(1);
  if (!booking) throw new Error("Booking cannot be changed from its current state");
  const [request] = await getDb().insert(bookingChangeRequests).values({ bookingId: booking.id, requestedBy: context.user.id, requestType: "DATE_CHANGE", requestedChanges: { checkIn: input.checkIn, checkOut: input.checkOut, reason: input.reason }, status: "PENDING" }).returning({ id: bookingChangeRequests.id });
  await getDb().insert(outboxEvents).values({ deduplicationKey: `date-change-${request.id}`, queueName: "operations", eventType: "BOOKING_DATE_CHANGE_REQUESTED", aggregateType: "booking_change_request", aggregateId: request.id, payload: { bookingId: booking.id, changeRequestId: request.id } });
  revalidatePath("/guest/upcoming-stays");
}

export async function createGuestWishlist(formData: FormData): Promise<void> {
  const input = z.object({ name: z.string().trim().min(2).max(100), visibility: z.enum(["PRIVATE", "SHARED"]) }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  await getDb().transaction(async (tx) => {
    const [wishlist] = await tx.insert(wishlists).values({ ownerUserId: context.user.id, name: input.name, visibility: input.visibility }).returning({ id: wishlists.id });
    await tx.insert(wishlistMembers).values({ wishlistId: wishlist.id, userId: context.user.id, role: "OWNER" });
  });
  revalidatePath("/guest/wishlists"); revalidatePath("/guest/favourites");
}

export async function addPropertyToGuestWishlist(formData: FormData): Promise<void> {
  const input = z.object({ wishlistId: z.string().uuid(), propertyId: z.string().uuid(), note: z.string().trim().max(500).default("") }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  const [membership] = await getDb().select().from(wishlistMembers).where(and(eq(wishlistMembers.wishlistId, input.wishlistId), eq(wishlistMembers.userId, context.user.id), inArray(wishlistMembers.role, ["OWNER", "EDITOR"]))).limit(1);
  if (!membership) throw new Error("Wishlist was not found");
  const [property] = await getDb().select({ status: properties.status, verifiedAt: properties.verifiedAt }).from(properties).where(eq(properties.id, input.propertyId)).limit(1);
  if (!property || property.status !== "PUBLISHED" || !property.verifiedAt) throw new Error("This property is not available to save");
  await getDb().insert(wishlistItems).values({ wishlistId: input.wishlistId, propertyId: input.propertyId, addedBy: context.user.id, note: input.note || null }).onConflictDoUpdate({ target: [wishlistItems.wishlistId, wishlistItems.propertyId], set: { note: input.note || null } });
  revalidatePath("/guest/wishlists");
}

export async function createGuestSavedSearch(formData: FormData): Promise<void> {
  const input = z.object({ name: z.string().trim().min(2).max(100), destination: z.string().trim().max(120).default(""), adults: z.coerce.number().int().min(1).max(30), rooms: z.coerce.number().int().min(1).max(15), propertyType: z.string().trim().max(80).default(""), maxPriceMinor: z.union([z.literal(""), z.coerce.number().int().min(0)]), alertsEnabled: z.string().optional() }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  await getDb().insert(savedSearches).values({ userId: context.user.id, name: input.name, criteria: { destination: input.destination, adults: input.adults, rooms: input.rooms, propertyTypes: input.propertyType ? [input.propertyType] : [], maxPriceMinor: input.maxPriceMinor === "" ? undefined : input.maxPriceMinor }, alertsEnabled: input.alertsEnabled === "on" });
  revalidatePath("/guest/saved-searches");
}

export async function updateGuestNotificationPreferences(formData: FormData): Promise<void> {
  const input = z.object({ marketing: z.string().optional(), smsTransactional: z.string().optional(), whatsappTransactional: z.string().optional() }).parse(Object.fromEntries(formData));
  const context = await requireGuest();
  await getDb().transaction(async (tx) => {
    await tx.insert(guestProfiles).values({ userId: context.user.id, marketingConsent: input.marketing === "on" }).onConflictDoUpdate({ target: guestProfiles.userId, set: { marketingConsent: input.marketing === "on", updatedAt: new Date() } });
    for (const [channel, granted] of [["SMS", input.smsTransactional === "on"], ["WHATSAPP", input.whatsappTransactional === "on"]] as const) {
      await tx.insert(notificationConsents).values({ userId: context.user.id, channel, purpose: "TRANSACTIONAL", granted, source: "ACCOUNT" }).onConflictDoUpdate({ target: [notificationConsents.userId, notificationConsents.channel, notificationConsents.purpose], set: { granted, source: "ACCOUNT", updatedAt: new Date() } });
    }
  });
  revalidatePath("/guest/profile");
}
