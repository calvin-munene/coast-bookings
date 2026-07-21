export const roles = [
  "GUEST",
  "HOST",
  "CO_HOST",
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "RESERVATIONS_OFFICER",
  "HOST_VERIFICATION_OFFICER",
  "FINANCE_OFFICER",
  "CUSTOMER_SUPPORT_OFFICER",
  "CONTENT_MODERATOR",
  "READ_ONLY_AUDITOR",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "property.read",
  "property.manage",
  "property.verify",
  "inventory.manage",
  "reservation.read",
  "reservation.manage",
  "message.manage",
  "guest.check_in",
  "finance.read",
  "payment.record",
  "refund.approve",
  "payout.read",
  "payout.approve",
  "payout_account.manage",
  "document.private.read",
  "support.manage",
  "audit.read",
  "role.manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = {
  GUEST: ["property.read", "reservation.read"],
  HOST: ["property.read", "property.manage", "inventory.manage", "reservation.read", "reservation.manage", "message.manage", "finance.read", "payout.read", "payout_account.manage"],
  CO_HOST: ["property.read", "inventory.manage", "reservation.read", "reservation.manage", "message.manage", "guest.check_in"],
  SUPER_ADMIN: permissions,
  OPERATIONS_MANAGER: ["property.read", "property.manage", "property.verify", "inventory.manage", "reservation.read", "reservation.manage", "message.manage", "support.manage", "audit.read"],
  RESERVATIONS_OFFICER: ["property.read", "reservation.read", "reservation.manage", "message.manage", "support.manage"],
  HOST_VERIFICATION_OFFICER: ["property.read", "property.verify", "document.private.read", "audit.read"],
  FINANCE_OFFICER: ["reservation.read", "finance.read", "payment.record", "refund.approve", "payout.read", "payout.approve", "document.private.read", "audit.read"],
  CUSTOMER_SUPPORT_OFFICER: ["property.read", "reservation.read", "message.manage", "support.manage"],
  CONTENT_MODERATOR: ["property.read", "property.manage"],
  READ_ONLY_AUDITOR: ["property.read", "reservation.read", "finance.read", "payout.read", "audit.read"],
};

export type AuthorisationContext = Readonly<{
  userId: string;
  roles: readonly Role[];
  explicitPermissions?: readonly Permission[];
  propertyIds?: readonly string[];
}>;

export function can(context: AuthorisationContext, permission: Permission, propertyId?: string): boolean {
  const roleGrant = context.roles.some((role) => rolePermissions[role].includes(permission));
  const explicitGrant = context.explicitPermissions?.includes(permission) ?? false;
  if (!roleGrant && !explicitGrant) return false;
  if (!propertyId || context.roles.some((role) => role.startsWith("SUPER_") || role.endsWith("OFFICER") || role === "OPERATIONS_MANAGER" || role === "READ_ONLY_AUDITOR")) return true;
  return context.propertyIds?.includes(propertyId) ?? false;
}

export function requirePermission(context: AuthorisationContext, permission: Permission, propertyId?: string): void {
  if (!can(context, permission, propertyId)) throw new Error(`Permission denied: ${permission}`);
}
