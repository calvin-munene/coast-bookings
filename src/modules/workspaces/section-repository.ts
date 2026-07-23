import "server-only";

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import {
  auditLogs,
  bookingChangeRequests,
  bookings,
  conversations,
  disputes,
  favourites,
  featureFlags,
  groupEnquiries,
  groupQuotes,
  hostDocuments,
  hostOrganizations,
  hostProfiles,
  inventoryPools,
  messages,
  organizationMemberships,
  paymentCheckoutSessions,
  payments,
  payouts,
  pricingSnapshots,
  properties,
  refunds,
  reviews,
  savedSearches,
  roles,
  securityEvents,
  supportTickets,
  systemSettings,
  unitInventoryDays,
  units,
  users,
  wishlistItems,
  wishlists,
} from "@/db/schema";
import { formatKes, formatShortDate } from "@/lib/format";

export type WorkspaceRecord = Readonly<{ id: string; title: string; detail: string; status: string; metric?: string; href?: string }>;
export type WorkspaceSectionData = Readonly<{ description: string; records: readonly WorkspaceRecord[]; emptyTitle: string; emptyCopy: string }>;

function section(description: string, records: readonly WorkspaceRecord[], emptyTitle = "No records yet", emptyCopy = "New authorised activity will appear here."): WorkspaceSectionData {
  return { description, records, emptyTitle, emptyCopy };
}

export async function guestSectionData(userId: string, active: string): Promise<WorkspaceSectionData> {
  if (["dashboard", "upcoming-stays", "pending-requests", "past-stays"].includes(active)) {
    const statusFilter = active === "upcoming-stays" ? ["CONFIRMED", "CHECKED_IN"] : active === "pending-requests" ? ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_REVIEW", "PAYMENT_FAILED"] : active === "past-stays" ? ["CHECKED_OUT", "COMPLETED", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST", "NO_SHOW", "REFUNDED", "PARTIALLY_REFUNDED"] : undefined;
    const rows = await getDb().select({ booking: bookings, propertyName: properties.name, total: pricingSnapshots.guestTotalMinor })
      .from(bookings).innerJoin(properties, eq(properties.id, bookings.propertyId)).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id))
      .where(and(eq(bookings.guestUserId, userId), statusFilter ? inArray(bookings.status, statusFilter as typeof bookings.status.enumValues) : undefined)).orderBy(desc(bookings.createdAt)).limit(30);
    return section("Trips, requests and payment states are read directly from your protected booking records.", rows.map(({ booking, propertyName, total }) => ({ id: booking.id, title: `${propertyName} · ${booking.reference}`, detail: `${booking.checkIn} to ${booking.checkOut} · ${booking.adults + booking.children} guests`, status: booking.status, metric: formatKes(total), href: booking.paymentStatus !== "SUCCEEDED" ? `/guest/payments?booking=${booking.id}` : undefined })), "No stays in this section", "Search verified coastal properties to begin a booking.");
  }
  if (active === "favourites") {
    const rows = await getDb().select({ property: properties }).from(favourites).innerJoin(properties, eq(properties.id, favourites.propertyId)).where(eq(favourites.userId, userId)).orderBy(desc(favourites.createdAt));
    return section("Saved properties remain private to your account.", rows.map(({ property }) => ({ id: property.id, title: property.name, detail: `${property.destination}, ${property.county}`, status: property.status, href: `/stays/${property.slug}` })), "No saved properties", "Use the heart on a listing to build your shortlist.");
  }
  if (active === "wishlists") {
    const rows = await getDb().select({ wishlist: wishlists, itemCount: sql<number>`count(${wishlistItems.propertyId})::int` }).from(wishlists).leftJoin(wishlistItems, eq(wishlistItems.wishlistId, wishlists.id)).where(eq(wishlists.ownerUserId, userId)).groupBy(wishlists.id).orderBy(desc(wishlists.updatedAt));
    return section("Named and collaborative shortlists help a travel party compare properties before booking.", rows.map(({ wishlist, itemCount }) => ({ id: wishlist.id, title: wishlist.name, detail: `${itemCount} saved properties`, status: wishlist.visibility })), "No wishlists", "Create a private or shared shortlist below.");
  }
  if (active === "saved-searches") {
    const rows = await getDb().select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.updatedAt));
    return section("Saved search criteria can power availability and price alerts without exposing your account.", rows.map((search) => ({ id: search.id, title: search.name, detail: JSON.stringify(search.criteria), status: search.alertsEnabled ? "ALERTS ON" : "SAVED", href: `/search?${new URLSearchParams(Object.entries(search.criteria).flatMap(([key, value]) => typeof value === "string" || typeof value === "number" ? [[key, String(value)]] : []).reduce<Record<string, string>>((record, [key, value]) => ({ ...record, [key]: value }), {})).toString()}` })), "No saved searches", "Save a destination and filters to return to it quickly.");
  }
  if (active === "payments" || active === "receipts") {
    const rows = await getDb().select({ payment: payments, bookingReference: bookings.reference }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).where(eq(bookings.guestUserId, userId)).orderBy(desc(payments.createdAt));
    return section("Whop and offline payments are shown with their verified server status.", rows.map(({ payment, bookingReference }) => ({ id: payment.id, title: `${bookingReference} · ${payment.reference}`, detail: `${payment.method} · ${formatShortDate(payment.createdAt)}`, status: payment.status, metric: formatKes(payment.amountMinor), href: payment.status === "PROCESSING" ? `/checkout/status?paymentId=${payment.id}` : undefined })), "No payments recorded", "Payments appear after a booking request reaches checkout.");
  }
  if (active === "refunds") {
    const rows = await getDb().select({ refund: refunds, bookingReference: bookings.reference }).from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId)).innerJoin(bookings, eq(bookings.id, payments.bookingId)).where(eq(bookings.guestUserId, userId)).orderBy(desc(refunds.createdAt));
    return section("Track calculated and provider-confirmed refunds.", rows.map(({ refund, bookingReference }) => ({ id: refund.id, title: `${bookingReference} refund`, detail: refund.reason, status: refund.status, metric: formatKes(refund.amountMinor) })), "No refund requests", "Eligible cancellation refunds will be tracked here.");
  }
  if (active === "group-quotes") {
    const rows = await getDb().select().from(groupEnquiries).where(eq(groupEnquiries.coordinatorId, userId)).orderBy(desc(groupEnquiries.createdAt));
    return section("Your group coordinator can follow every enquiry and quotation stage.", rows.map((enquiry) => ({ id: enquiry.id, title: `${enquiry.reference} · ${enquiry.organisationName}`, detail: `${enquiry.destination} · ${enquiry.checkIn} to ${enquiry.checkOut}`, status: enquiry.status, href: `/request-quote?reference=${enquiry.reference}` })), "No group enquiries", "Submit one detailed brief and Coast Bookings will prepare comparable options.");
  }
  if (active === "messages") {
    const rows = await getDb().select({ conversation: conversations, message: messages }).from(conversations).leftJoin(messages, eq(messages.conversationId, conversations.id)).innerJoin(bookings, eq(bookings.id, conversations.bookingId)).where(eq(bookings.guestUserId, userId)).orderBy(desc(messages.createdAt)).limit(40);
    return section("Booking-linked conversations preserve a private service history.", rows.map(({ conversation, message }) => ({ id: conversation.id, title: conversation.subject, detail: message?.body ?? "Conversation created", status: message ? "ACTIVE" : "NEW", href: `/guest/messages?conversation=${conversation.id}` })), "No conversations", "A conversation is opened when a booking or support request needs a response.");
  }
  if (active === "reviews") {
    const rows = await getDb().select({ review: reviews, propertyName: properties.name }).from(reviews).innerJoin(properties, eq(properties.id, reviews.propertyId)).where(eq(reviews.guestId, userId)).orderBy(desc(reviews.createdAt));
    return section("Only completed stays can be reviewed, with one review per booking.", rows.map(({ review, propertyName }) => ({ id: review.id, title: propertyName, detail: review.body, status: review.status })), "No reviews yet", "Completed trips become reviewable for 14 days.");
  }
  const [profile] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return section("Manage the identity, consent and security information attached to your account.", profile ? [{ id: profile.id, title: profile.fullName, detail: `${profile.primaryEmail} · ${profile.phone ?? "No phone added"}`, status: profile.status }] : [], "Profile unavailable", "Complete account onboarding to use this workspace.");
}

export async function hostSectionData(organizationId: string, active: string): Promise<WorkspaceSectionData> {
  if (["dashboard", "properties"].includes(active)) {
    const rows = await getDb().select().from(properties).where(eq(properties.hostOrganizationId, organizationId)).orderBy(desc(properties.updatedAt));
    return section("Listings stay private until Coast Bookings verifies and publishes them.", rows.map((property) => ({ id: property.id, title: property.name, detail: `${property.destination}, ${property.county} · version ${property.version}`, status: property.status, href: property.status === "PUBLISHED" ? `/stays/${property.slug}` : undefined })), "No properties created", "Create your first property using the form below.");
  }
  if (active === "verification") {
    const rows = await getDb().select({ document: hostDocuments }).from(hostDocuments).innerJoin(hostProfiles, eq(hostProfiles.id, hostDocuments.hostId)).where(eq(hostProfiles.hostOrganizationId, organizationId)).orderBy(desc(hostDocuments.createdAt));
    return section("Private host documents are visible only to the host organisation and authorised verification staff.", rows.map(({ document }) => ({ id: document.id, title: document.documentType, detail: document.expiresOn ? `Expires ${document.expiresOn}` : "No expiry date", status: document.status })), "No verification documents", "Upload identity, authority, licensing and safety records below.");
  }
  if (active === "units" || active === "rates") {
    const rows = await getDb().select({ unit: units, propertyName: properties.name }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(eq(properties.hostOrganizationId, organizationId)).orderBy(asc(properties.name), asc(units.name));
    return section("Room types, capacity, booking mode and integer KES rates are managed independently.", rows.map(({ unit, propertyName }) => ({ id: unit.id, title: `${propertyName} · ${unit.name}`, detail: `${unit.quantity} available · sleeps ${unit.capacity} · ${unit.bookingMode}`, status: unit.active ? "ACTIVE" : "INACTIVE", metric: `${formatKes(unit.baseNightlyRateMinor)}/night` })), "No rooms or units", "Add at least one unit before submitting a property.");
  }
  if (active === "calendar" || active === "availability") {
    const rows = await getDb().select({ day: unitInventoryDays, poolName: inventoryPools.name, propertyName: properties.name }).from(unitInventoryDays).innerJoin(inventoryPools, eq(inventoryPools.id, unitInventoryDays.poolId)).innerJoin(properties, eq(properties.id, inventoryPools.propertyId)).where(eq(properties.hostOrganizationId, organizationId)).orderBy(asc(unitInventoryDays.inventoryDate)).limit(60);
    return section("Daily capacity, held rooms, sold rooms and restrictions are enforced by PostgreSQL.", rows.map(({ day, poolName, propertyName }) => ({ id: `${day.poolId}-${day.inventoryDate}`, title: `${propertyName} · ${poolName}`, detail: `${day.inventoryDate} · ${day.sold} sold · ${day.held} held`, status: day.closed ? "CLOSED" : "OPEN", metric: `${day.capacity - day.sold - day.held} left` })), "No calendar inventory", "Generate inventory dates after adding a unit.");
  }
  if (active === "reservations") {
    const rows = await getDb().select({ booking: bookings, propertyName: properties.name, total: pricingSnapshots.guestTotalMinor }).from(bookings).innerJoin(properties, eq(properties.id, bookings.propertyId)).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id)).where(eq(bookings.hostOrganizationId, organizationId)).orderBy(desc(bookings.createdAt)).limit(50);
    return section("Accept requests, prepare arrivals and track only reservations belonging to your organisation.", rows.map(({ booking, propertyName, total }) => ({ id: booking.id, title: `${booking.reference} · ${propertyName}`, detail: `${booking.checkIn} to ${booking.checkOut} · ${booking.adults + booking.children} guests`, status: booking.status, metric: formatKes(total) })), "No reservations", "Published availability will create reservation activity here.");
  }
  if (active === "earnings" || active === "payouts") {
    const rows = await getDb().select({ payout: payouts, bookingReference: bookings.reference }).from(payouts).innerJoin(bookings, eq(bookings.id, payouts.bookingId)).where(eq(payouts.hostOrganizationId, organizationId)).orderBy(desc(payouts.createdAt));
    return section("Payout eligibility is recorded after check-in and remains manual until automation is approved.", rows.map(({ payout, bookingReference }) => ({ id: payout.id, title: `${bookingReference} payout`, detail: `Eligible ${formatShortDate(payout.eligibleAt)}`, status: payout.status, metric: formatKes(payout.amountMinor) })), "No payouts generated", "Eligible confirmed bookings generate one reconciled payout record.");
  }
  if (active === "team") {
    const rows = await getDb().select({ membership: organizationMemberships, member: users }).from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId)).where(eq(organizationMemberships.organizationId, organizationId)).orderBy(asc(users.fullName));
    return section("Co-host roles are least-privilege and never inherit payout-account authority automatically.", rows.map(({ membership, member }) => ({ id: membership.id, title: member.fullName, detail: member.primaryEmail, status: `${membership.roleKey} · ${membership.status}` })), "No team members", "Owners can invite reservations, front-desk, accounting or viewer roles.");
  }
  if (active === "support") {
    const rows = await getDb().select({ ticket: supportTickets }).from(supportTickets).where(eq(supportTickets.hostOrganizationId, organizationId)).orderBy(desc(supportTickets.updatedAt));
    return section("Support and dispute records remain linked to the affected booking.", rows.map(({ ticket }) => ({ id: ticket.id, title: `${ticket.reference} · ${ticket.subject}`, detail: ticket.category, status: ticket.status })), "No support tickets", "Raise a ticket when an operational issue needs Coast Bookings staff.");
  }
  const documentRows = await getDb().select({ document: hostDocuments }).from(hostDocuments).innerJoin(hostProfiles, eq(hostProfiles.id, hostDocuments.hostId)).where(eq(hostProfiles.hostOrganizationId, organizationId)).orderBy(desc(hostDocuments.createdAt));
  return section("This operational section is backed by your organisation's protected records.", documentRows.map(({ document }) => ({ id: document.id, title: document.documentType, detail: document.expiresOn ? `Expires ${document.expiresOn}` : "No expiry date", status: document.status })), "Nothing requires attention", "New authorised activity will appear here.");
}

export async function operationsSectionData(active: string): Promise<WorkspaceSectionData> {
  if (["dashboard", "bookings", "manual-bookings", "availability"].includes(active)) {
    const rows = await getDb().select({ booking: bookings, propertyName: properties.name, total: pricingSnapshots.guestTotalMinor }).from(bookings).innerJoin(properties, eq(properties.id, bookings.propertyId)).innerJoin(pricingSnapshots, eq(pricingSnapshots.bookingId, bookings.id)).orderBy(desc(bookings.createdAt)).limit(60);
    return section("Operations can supervise every booking without bypassing its state machine.", rows.map(({ booking, propertyName, total }) => ({ id: booking.id, title: `${booking.reference} · ${propertyName}`, detail: `${booking.bookingMode} · ${booking.checkIn} to ${booking.checkOut}`, status: booking.status, metric: formatKes(total) })), "No bookings", "Reservations appear after guests or staff create them.");
  }
  if (["crm", "group-enquiries", "property-sourcing", "quotations"].includes(active)) {
    const rows = await getDb().select({ enquiry: groupEnquiries, quote: groupQuotes }).from(groupEnquiries).leftJoin(groupQuotes, eq(groupQuotes.enquiryId, groupEnquiries.id)).orderBy(desc(groupEnquiries.updatedAt)).limit(60);
    return section("The group CRM preserves requirements, sourcing, quotations and conversion status.", rows.map(({ enquiry, quote }) => ({ id: enquiry.id, title: `${enquiry.reference} · ${enquiry.organisationName}`, detail: `${enquiry.destination} · ${enquiry.adults + enquiry.children + enquiry.supervisors} travellers${quote ? ` · quote ${quote.reference}` : ""}`, status: enquiry.status })), "No group enquiries", "New group briefs appear here for assignment.");
  }
  if (active === "host-onboarding") {
    const rows = await getDb().select().from(hostOrganizations).where(ne(hostOrganizations.status, "VERIFIED")).orderBy(desc(hostOrganizations.updatedAt));
    return section("Verify organisations, documents and risk indicators before allowing public supply.", rows.map((organization) => ({ id: organization.id, title: organization.name, detail: organization.slug, status: organization.status })), "No host applications", "New host organisations enter this queue after onboarding.");
  }
  if (active === "property-verification") {
    const rows = await getDb().select().from(properties).where(inArray(properties.status, ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "VERIFIED"])).orderBy(asc(properties.updatedAt));
    return section("No submitted listing becomes public without an authorised approval action.", rows.map((property) => ({ id: property.id, title: property.name, detail: `${property.destination}, ${property.county}`, status: property.status })), "Verification queue is clear", "Submitted listings will appear here.");
  }
  if (active === "payments") {
    const rows = await getDb().select({ payment: payments, bookingReference: bookings.reference, checkout: paymentCheckoutSessions.providerSessionId }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).leftJoin(paymentCheckoutSessions, eq(paymentCheckoutSessions.paymentId, payments.id)).orderBy(desc(payments.createdAt)).limit(80);
    return section("Finance can reconcile Whop callbacks, offline records and provider exceptions.", rows.map(({ payment, bookingReference, checkout }) => ({ id: payment.id, title: `${bookingReference} · ${payment.reference}`, detail: `${payment.provider} · ${checkout ?? payment.providerTransactionId ?? "No provider ID"}`, status: `${payment.status} · ${payment.reconciliationStatus}`, metric: formatKes(payment.amountMinor) })), "No payments", "Provider and manual payments will appear here.");
  }
  if (active === "refunds") {
    const rows = await getDb().select({ refund: refunds, bookingReference: bookings.reference }).from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId)).innerJoin(bookings, eq(bookings.id, payments.bookingId)).orderBy(desc(refunds.createdAt));
    return section("Overrides require an approver, reason and immutable audit record.", rows.map(({ refund, bookingReference }) => ({ id: refund.id, title: `${bookingReference} refund`, detail: refund.reason, status: refund.status, metric: formatKes(refund.amountMinor) })), "No refunds", "Approved cancellation or dispute refunds will appear here.");
  }
  if (active === "payouts" || active === "supplier-balances" || active === "commission") {
    const rows = await getDb().select({ payout: payouts, organizationName: hostOrganizations.name, bookingReference: bookings.reference }).from(payouts).innerJoin(hostOrganizations, eq(hostOrganizations.id, payouts.hostOrganizationId)).innerJoin(bookings, eq(bookings.id, payouts.bookingId)).orderBy(desc(payouts.createdAt));
    return section("Host payouts are manually approved, duplicate-protected and dispute-aware.", rows.map(({ payout, organizationName, bookingReference }) => ({ id: payout.id, title: `${organizationName} · ${bookingReference}`, detail: `Eligible ${formatShortDate(payout.eligibleAt)}`, status: payout.status, metric: formatKes(payout.amountMinor) })), "No host payables", "Confirmed stays create payable records after the eligibility point.");
  }
  if (["support", "incidents"].includes(active)) {
    const rows = await getDb().select().from(supportTickets).orderBy(desc(supportTickets.updatedAt));
    return section("Tickets keep messages, attachments, assignment, priority and resolution together.", rows.map((ticket) => ({ id: ticket.id, title: `${ticket.reference} · ${ticket.subject}`, detail: `${ticket.category} · ${ticket.priority}`, status: ticket.status })), "Support queue is clear", "New customer and host cases will appear here.");
  }
  if (active === "disputes") {
    const rows = await getDb().select().from(disputes).orderBy(desc(disputes.updatedAt));
    return section("An active dispute holds host payout and preserves its evidence history.", rows.map((dispute) => ({ id: dispute.id, title: `${dispute.reference} · ${dispute.category}`, detail: dispute.summary, status: dispute.status })), "No active disputes", "Payment and service disputes will appear here.");
  }
  if (active === "audit") {
    const rows = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return section("Sensitive operations produce immutable actor, target and reason records.", rows.map((audit) => ({ id: audit.id, title: `${audit.action} · ${audit.entityType}`, detail: `${audit.entityId ?? "platform"} · ${formatShortDate(audit.createdAt)}`, status: audit.reason ?? "RECORDED" })), "No audit events", "Sensitive staff actions will be recorded here.");
  }
  const changes = await getDb().select().from(bookingChangeRequests).orderBy(desc(bookingChangeRequests.updatedAt)).limit(50);
  return section("Operational exceptions are handled through controlled records rather than direct database edits.", changes.map((change) => ({ id: change.id, title: change.requestType, detail: change.decisionReason ?? "Awaiting decision", status: change.status })), "Nothing requires attention", "New operational exceptions will appear here.");
}

export async function adminSectionData(active: string): Promise<WorkspaceSectionData> {
  if (active === "users" || active === "dashboard") {
    const rows = await getDb().select().from(users).orderBy(desc(users.createdAt)).limit(80);
    return section("Administrator identity records remain synchronized with Clerk and locally restricted by status.", rows.map((user) => ({ id: user.id, title: user.fullName, detail: user.primaryEmail, status: `${user.status}${user.mfaEnabled ? " · MFA" : ""}` })), "No users", "Clerk webhook synchronisation creates user records.");
  }
  if (active === "roles" || active === "permissions") {
    const rows = await getDb().select().from(roles).orderBy(asc(roles.scope), asc(roles.name));
    return section("Roles are explicit permission bundles; UI visibility never replaces server enforcement.", rows.map((role) => ({ id: role.id, title: role.name, detail: role.permissions.join(", "), status: role.scope })), "No roles", "Run the seed to install the permission model.");
  }
  if (active === "feature-flags") {
    const rows = await getDb().select().from(featureFlags).orderBy(asc(featureFlags.key));
    return section("Risky integrations remain disabled until staging certification and controlled rollout.", rows.map((flag) => ({ id: flag.key, title: flag.key, detail: flag.description, status: flag.enabled ? `ENABLED · ${flag.rolloutPercentage}%` : "DISABLED" })), "No feature flags", "Run the marketplace seed to install release controls.");
  }
  if (["commission-settings", "payment-settings", "notification-integrations", "email-settings", "whatsapp-settings", "data-retention"].includes(active)) {
    const rows = await getDb().select().from(systemSettings).orderBy(asc(systemSettings.key));
    return section("Versioned system settings control business policy without hard-coding operational choices.", rows.map((setting) => ({ id: setting.key, title: setting.key, detail: JSON.stringify(setting.value), status: `VERSION ${setting.version}` })), "No settings", "Run the seed to install safe defaults.");
  }
  if (active === "security-events") {
    const rows = await getDb().select().from(securityEvents).orderBy(desc(securityEvents.occurredAt)).limit(100);
    return section("Authentication, authorization and sensitive-document access events are independently recorded.", rows.map((event) => ({ id: event.id, title: event.eventType, detail: `${event.targetType ?? "platform"} · ${formatShortDate(event.occurredAt)}`, status: event.outcome })), "No security events", "Security monitoring events appear here.");
  }
  const rows = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  return section("Administration is default-deny, MFA-protected and completely auditable.", rows.map((audit) => ({ id: audit.id, title: audit.action, detail: `${audit.entityType} · ${audit.entityId ?? "platform"}`, status: audit.reason ?? "RECORDED" })), "No administrative events", "Sensitive changes will be displayed here.");
}
