import "server-only";
import { auth } from "@clerk/nextjs/server";
import {
  AccountRestrictedError,
  ForbiddenError,
  OrganizationContextRequiredError,
  ResourceNotFoundError,
  UnauthenticatedError,
} from "./errors";
import {
  findActiveMembership,
  findUserByClerkId,
  guestOwnsBooking,
  hostOwnsBooking,
  hostOwnsProperty,
  userCanAccessPayment,
  userCanAccessTicket,
  type ActiveMembership,
  type ApplicationUser,
} from "./repository";
import {
  hostRoleHasPermission,
  internalRoleHasPermission,
  type HostPermission,
  type InternalPermission,
} from "./permissions";

export type AuthorizationContext = Readonly<{
  clerkUserId: string;
  user: ApplicationUser;
  membership: ActiveMembership | null;
}>;

async function sessionIdentity(): Promise<{ clerkUserId: string; clerkOrganizationId: string | null }> {
  const session = await auth();
  if (!session.userId) throw new UnauthenticatedError();
  return { clerkUserId: session.userId, clerkOrganizationId: session.orgId ?? null };
}

export async function requireAuthenticatedUser(): Promise<AuthorizationContext> {
  const identity = await sessionIdentity();
  const user = await findUserByClerkId(identity.clerkUserId);
  if (!user) throw new AccountRestrictedError();
  const membership = identity.clerkOrganizationId
    ? await findActiveMembership(user.id, identity.clerkOrganizationId)
    : null;
  return { clerkUserId: identity.clerkUserId, user, membership };
}

export async function requireActiveUser(): Promise<AuthorizationContext> {
  const context = await requireAuthenticatedUser();
  if (context.user.status !== "ACTIVE" || context.user.deletedAt) throw new AccountRestrictedError();
  return context;
}

export async function requireGuest(): Promise<AuthorizationContext> {
  const context = await requireActiveUser();
  if (context.membership?.organizationType === "INTERNAL") throw new ForbiddenError();
  return context;
}

export async function requireHostOrganization(): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireActiveUser();
  if (!context.membership) throw new OrganizationContextRequiredError();
  const allowedStatuses = ["PENDING_VERIFICATION", "VERIFIED", "ACTIVE"];
  if (context.membership.organizationType !== "HOST" || !allowedStatuses.includes(context.membership.organizationStatus)) throw new ForbiddenError();
  return { ...context, membership: context.membership };
}

export async function requireHostPermission(permission: HostPermission): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireHostOrganization();
  if (!hostRoleHasPermission(context.membership.roleKey, permission)) throw new ForbiddenError();
  return context;
}

export async function requireInternalStaff(): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireActiveUser();
  if (!context.user.mfaEnabled) throw new ForbiddenError("Multi-factor authentication is required for internal access");
  if (!context.membership || context.membership.organizationType !== "INTERNAL") throw new ForbiddenError();
  const configuredInternalOrganization = process.env.CLERK_INTERNAL_ORGANIZATION_ID;
  if (!configuredInternalOrganization || context.membership.clerkOrganizationId !== configuredInternalOrganization) throw new ForbiddenError();
  return { ...context, membership: context.membership };
}

export async function requireInternalPermission(permission: InternalPermission): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireInternalStaff();
  if (!internalRoleHasPermission(context.membership.roleKey, permission)) throw new ForbiddenError();
  return context;
}

export async function requireSuperAdmin(): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireInternalStaff();
  if (context.membership.roleKey !== "org:super_admin") throw new ForbiddenError();
  return context;
}

export async function requireGuestBookingAccess(bookingId: string): Promise<AuthorizationContext> {
  const context = await requireGuest();
  if (!(await guestOwnsBooking(bookingId, context.user.id))) throw new ResourceNotFoundError();
  return context;
}

export async function requireHostBookingAccess(bookingId: string): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireHostPermission("host:reservations:view");
  if (!(await hostOwnsBooking(bookingId, context.membership.organizationId))) throw new ResourceNotFoundError();
  return context;
}

export async function requireHostPropertyAccess(propertyId: string): Promise<AuthorizationContext & { membership: ActiveMembership }> {
  const context = await requireHostPermission("host:property:view");
  if (!(await hostOwnsProperty(propertyId, context.membership.organizationId))) throw new ResourceNotFoundError();
  return context;
}

export async function requireSupportTicketAccess(ticketId: string): Promise<AuthorizationContext> {
  const context = await requireActiveUser();
  if (context.membership?.organizationType === "INTERNAL") {
    if (!internalRoleHasPermission(context.membership.roleKey, "internal:support:manage")) throw new ForbiddenError();
    return context;
  }
  if (!(await userCanAccessTicket(ticketId, context.user.id, context.membership?.organizationId))) throw new ResourceNotFoundError();
  return context;
}

export async function requirePaymentAccess(paymentId: string): Promise<AuthorizationContext> {
  const context = await requireActiveUser();
  if (context.membership?.organizationType === "INTERNAL") {
    if (!internalRoleHasPermission(context.membership.roleKey, "internal:payments:view")) throw new ForbiddenError();
    return context;
  }
  if (!(await userCanAccessPayment(paymentId, context.user.id, context.membership?.organizationId))) throw new ResourceNotFoundError();
  return context;
}

export async function requireRecentReverification(level: "strict" | "strict_mfa" = "strict"): Promise<void> {
  const session = await auth();
  if (!session.userId || !session.has({ reverification: level })) throw new ForbiddenError("Recent identity verification is required");
}
