import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { permissions as permissionRecords, rolePermissions, roles, systemSettings } from "./schema";
import {
  HOST_PERMISSIONS,
  HOST_ROLE_GRANTS,
  HOST_ROLES,
  INTERNAL_PERMISSIONS,
  INTERNAL_ROLE_GRANTS,
  INTERNAL_ROLES,
  type Permission,
} from "@/modules/authorization/permissions";

const db = getDb();

function permissionDescription(permission: Permission): string {
  return permission.replaceAll(":", " ").replaceAll("-", " ");
}

await db.transaction(async (tx) => {
  await tx.insert(permissionRecords).values(
    [...INTERNAL_PERMISSIONS, ...HOST_PERMISSIONS].map((code) => ({ code, description: permissionDescription(code) })),
  ).onConflictDoNothing();

  await tx.insert(roles).values([
    ...INTERNAL_ROLES.map((code) => ({ code, scope: "INTERNAL" as const, name: code.replace("org:", "").replaceAll("_", " "), permissions: [...INTERNAL_ROLE_GRANTS[code]] })),
    ...HOST_ROLES.map((code) => ({ code, scope: "HOST" as const, name: code.replace("org:", "").replaceAll("_", " "), permissions: [...HOST_ROLE_GRANTS[code]] })),
  ]).onConflictDoNothing();

  const savedPermissions = await tx.select().from(permissionRecords);
  const savedRoles = await tx.select().from(roles);
  const permissionId = new Map(savedPermissions.map((permission) => [permission.code, permission.id]));

  for (const role of savedRoles) {
    const grants = role.scope === "INTERNAL"
      ? INTERNAL_ROLE_GRANTS[role.code as keyof typeof INTERNAL_ROLE_GRANTS]
      : HOST_ROLE_GRANTS[role.code as keyof typeof HOST_ROLE_GRANTS];
    if (!grants) continue;
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await tx.insert(rolePermissions).values(grants.map((code) => ({ roleId: role.id, permissionId: permissionId.get(code)! })));
  }

  await tx.insert(systemSettings).values([
    { key: "booking.request_to_book.host_response_minutes", value: 720 },
    { key: "booking.request_to_book.payment_minutes", value: 120 },
    { key: "booking.instant.hold_minutes", value: 15 },
    { key: "payout.eligibility_hours_after_check_in", value: 24 },
    { key: "payout.automation_enabled", value: false },
    { key: "marketplace.currency", value: "KES" },
    { key: "marketplace.indexing_enabled", value: false },
  ]).onConflictDoNothing();

  // Keep imports used when Drizzle narrows transaction types differently across minor versions.
  void and;
});

console.log("Seeded Coast Bookings permissions, scoped roles, and Replit defaults.");
