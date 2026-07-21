export const INTERNAL_PERMISSIONS = [
  "internal:dashboard:view",
  "internal:enquiries:view",
  "internal:enquiries:manage",
  "internal:quotes:create",
  "internal:quotes:approve",
  "internal:bookings:view",
  "internal:bookings:manage",
  "internal:payments:view",
  "internal:payments:record",
  "internal:refunds:request",
  "internal:refunds:approve",
  "internal:payouts:view",
  "internal:payouts:approve",
  "internal:hosts:verify",
  "internal:properties:approve",
  "internal:support:manage",
  "internal:reports:view",
  "internal:users:manage",
  "internal:roles:manage",
  "internal:audit:view",
  "internal:settings:manage",
] as const;

export const HOST_PERMISSIONS = [
  "host:property:view",
  "host:property:manage",
  "host:calendar:manage",
  "host:rates:manage",
  "host:reservations:view",
  "host:reservations:manage",
  "host:messages:manage",
  "host:earnings:view",
  "host:payouts:view",
  "host:payout-account:manage",
  "host:staff:manage",
] as const;

export const PERMISSIONS = [...INTERNAL_PERMISSIONS, ...HOST_PERMISSIONS] as const;
export type InternalPermission = (typeof INTERNAL_PERMISSIONS)[number];
export type HostPermission = (typeof HOST_PERMISSIONS)[number];
export type Permission = (typeof PERMISSIONS)[number];

export const INTERNAL_ROLES = [
  "org:super_admin",
  "org:operations_manager",
  "org:reservations",
  "org:finance",
  "org:host_verifier",
  "org:customer_support",
  "org:marketing",
  "org:auditor",
] as const;

export const HOST_ROLES = [
  "org:owner",
  "org:property_manager",
  "org:reservations",
  "org:front_desk",
  "org:accountant",
  "org:viewer",
] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type HostRole = (typeof HOST_ROLES)[number];

export const INTERNAL_ROLE_GRANTS: Readonly<Record<InternalRole, readonly InternalPermission[]>> = {
  "org:super_admin": INTERNAL_PERMISSIONS,
  "org:operations_manager": INTERNAL_PERMISSIONS.filter((permission) => !["internal:roles:manage", "internal:settings:manage"].includes(permission)),
  "org:reservations": ["internal:dashboard:view", "internal:enquiries:view", "internal:enquiries:manage", "internal:quotes:create", "internal:bookings:view", "internal:bookings:manage", "internal:support:manage"],
  "org:finance": ["internal:dashboard:view", "internal:bookings:view", "internal:payments:view", "internal:payments:record", "internal:refunds:request", "internal:refunds:approve", "internal:payouts:view", "internal:payouts:approve", "internal:reports:view", "internal:audit:view"],
  "org:host_verifier": ["internal:dashboard:view", "internal:hosts:verify", "internal:properties:approve", "internal:audit:view"],
  "org:customer_support": ["internal:dashboard:view", "internal:enquiries:view", "internal:bookings:view", "internal:refunds:request", "internal:support:manage"],
  "org:marketing": ["internal:dashboard:view", "internal:reports:view"],
  "org:auditor": ["internal:dashboard:view", "internal:enquiries:view", "internal:bookings:view", "internal:payments:view", "internal:payouts:view", "internal:reports:view", "internal:audit:view"],
};

export const HOST_ROLE_GRANTS: Readonly<Record<HostRole, readonly HostPermission[]>> = {
  "org:owner": HOST_PERMISSIONS,
  "org:property_manager": HOST_PERMISSIONS.filter((permission) => permission !== "host:payout-account:manage"),
  "org:reservations": ["host:property:view", "host:calendar:manage", "host:reservations:view", "host:reservations:manage", "host:messages:manage"],
  "org:front_desk": ["host:property:view", "host:reservations:view", "host:reservations:manage", "host:messages:manage"],
  "org:accountant": ["host:property:view", "host:reservations:view", "host:earnings:view", "host:payouts:view"],
  "org:viewer": ["host:property:view", "host:reservations:view"],
};

export function isInternalRole(value: string): value is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(value);
}

export function isHostRole(value: string): value is HostRole {
  return (HOST_ROLES as readonly string[]).includes(value);
}

export function internalRoleHasPermission(role: string, permission: InternalPermission): boolean {
  return isInternalRole(role) && INTERNAL_ROLE_GRANTS[role].includes(permission);
}

export function hostRoleHasPermission(role: string, permission: HostPermission): boolean {
  return isHostRole(role) && HOST_ROLE_GRANTS[role].includes(permission);
}
