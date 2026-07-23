import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/connection";
import {
  bookings,
  hostOrganizations,
  organizationMemberships,
  payments,
  properties,
  supportTickets,
  users,
} from "@/db/schema";

export type ApplicationUser = typeof users.$inferSelect;
export type ActiveMembership = Readonly<{
  id: string;
  organizationId: string;
  clerkOrganizationId: string;
  organizationType: "HOST" | "INTERNAL";
  organizationStatus: string;
  roleKey: string;
}>;

export async function findUserByClerkId(clerkUserId: string): Promise<ApplicationUser | null> {
  const [user] = await getDb().select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return user ?? null;
}

export async function findActiveMembership(userId: string, clerkOrganizationId: string): Promise<ActiveMembership | null> {
  const now = new Date();
  const [membership] = await getDb()
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      clerkOrganizationId: hostOrganizations.clerkOrganizationId,
      organizationType: hostOrganizations.type,
      organizationStatus: hostOrganizations.status,
      roleKey: organizationMemberships.roleKey,
    })
    .from(organizationMemberships)
    .innerJoin(hostOrganizations, eq(hostOrganizations.id, organizationMemberships.organizationId))
    .where(and(
      eq(organizationMemberships.userId, userId),
      eq(hostOrganizations.clerkOrganizationId, clerkOrganizationId),
      eq(organizationMemberships.status, "ACTIVE"),
      or(isNull(organizationMemberships.expiresAt), gt(organizationMemberships.expiresAt, now)),
    ))
    .limit(1);
  return membership ?? null;
}

export async function listActiveMemberships(userId: string): Promise<ActiveMembership[]> {
  const now = new Date();
  return getDb()
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      clerkOrganizationId: hostOrganizations.clerkOrganizationId,
      organizationType: hostOrganizations.type,
      organizationStatus: hostOrganizations.status,
      roleKey: organizationMemberships.roleKey,
    })
    .from(organizationMemberships)
    .innerJoin(hostOrganizations, eq(hostOrganizations.id, organizationMemberships.organizationId))
    .where(and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.status, "ACTIVE"),
      or(isNull(organizationMemberships.expiresAt), gt(organizationMemberships.expiresAt, now)),
    ));
}

export async function guestOwnsBooking(bookingId: string, userId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: bookings.id }).from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.guestUserId, userId))).limit(1);
  return Boolean(row);
}

export async function hostOwnsBooking(bookingId: string, organizationId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: bookings.id }).from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.hostOrganizationId, organizationId))).limit(1);
  return Boolean(row);
}

export async function hostOwnsProperty(propertyId: string, organizationId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: properties.id }).from(properties).where(and(eq(properties.id, propertyId), eq(properties.hostOrganizationId, organizationId))).limit(1);
  return Boolean(row);
}

export async function userCanAccessTicket(ticketId: string, userId: string, organizationId?: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: supportTickets.userId, hostOrganizationId: bookings.hostOrganizationId })
    .from(supportTickets)
    .leftJoin(bookings, eq(bookings.id, supportTickets.bookingId))
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  return Boolean(row && (row.userId === userId || (organizationId && row.hostOrganizationId === organizationId)));
}

export async function userCanAccessPayment(paymentId: string, userId: string, organizationId?: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ guestUserId: bookings.guestUserId, hostOrganizationId: bookings.hostOrganizationId })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(eq(payments.id, paymentId))
    .limit(1);
  return Boolean(row && (row.guestUserId === userId || (organizationId && row.hostOrganizationId === organizationId)));
}
