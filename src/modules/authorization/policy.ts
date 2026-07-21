import { hostRoleHasPermission, internalRoleHasPermission, type HostPermission, type InternalPermission } from "./permissions";

export type PolicyUser = Readonly<{ id: string; status: "PENDING" | "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "DELETED"; mfaEnabled: boolean }>;
export type PolicyMembership = Readonly<{ organizationId: string; organizationType: "HOST" | "INTERNAL"; organizationStatus: string; roleKey: string; expiresAt: Date | null }>;

export function isActivePolicyUser(user: PolicyUser): boolean { return user.status === "ACTIVE"; }
export function isCurrentMembership(membership: PolicyMembership, now = new Date()): boolean { return membership.expiresAt === null || membership.expiresAt > now; }
export function mayEnterGuest(user: PolicyUser, membership: PolicyMembership | null): boolean { return isActivePolicyUser(user) && membership?.organizationType !== "INTERNAL"; }
export function mayEnterHost(user: PolicyUser, membership: PolicyMembership | null, now = new Date()): boolean { return Boolean(isActivePolicyUser(user) && membership?.organizationType === "HOST" && isCurrentMembership(membership, now) && ["PENDING_VERIFICATION", "VERIFIED", "ACTIVE"].includes(membership.organizationStatus)); }
export function mayEnterInternal(user: PolicyUser, membership: PolicyMembership | null, configuredInternalOrganizationId: string, now = new Date()): boolean { return Boolean(isActivePolicyUser(user) && user.mfaEnabled && membership?.organizationType === "INTERNAL" && membership.organizationId === configuredInternalOrganizationId && isCurrentMembership(membership, now)); }
export function mayUseHostPermission(membership: PolicyMembership, permission: HostPermission): boolean { return membership.organizationType === "HOST" && hostRoleHasPermission(membership.roleKey, permission); }
export function mayUseInternalPermission(membership: PolicyMembership, permission: InternalPermission): boolean { return membership.organizationType === "INTERNAL" && internalRoleHasPermission(membership.roleKey, permission); }
export function isSameTenantResource(resourceOrganizationId: string, membership: PolicyMembership): boolean { return resourceOrganizationId === membership.organizationId; }
export function isOwnGuestResource(resourceUserId: string, user: PolicyUser): boolean { return resourceUserId === user.id; }
export function isPublicRegistrationRole(role: string): boolean { return role === "guest" || role === "host"; }
export function sensitiveActionRequiresReverification(permission: InternalPermission): boolean { return ["internal:roles:manage", "internal:payouts:approve", "internal:refunds:approve", "internal:settings:manage"].includes(permission); }
