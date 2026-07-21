import "dotenv/config";
import { getDb } from "./connection";
import { roles, systemSettings } from "./schema";
import { permissions, roles as roleCodes, type Permission, type Role } from "@/modules/permissions/service";

const db = getDb();

const grants: Record<Role, readonly Permission[]> = {
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

await db.insert(roles).values(roleCodes.map((code) => ({ code, name: code.replaceAll("_", " "), permissions: [...grants[code]] }))).onConflictDoNothing();
await db.insert(systemSettings).values([
  { key: "booking.request_to_book.host_response_minutes", value: 720 },
  { key: "booking.request_to_book.payment_minutes", value: 120 },
  { key: "booking.instant.hold_minutes", value: 15 },
  { key: "payout.eligibility_hours_after_check_in", value: 24 },
  { key: "payout.automation_enabled", value: false },
  { key: "marketplace.currency", value: "KES" },
  { key: "marketplace.indexing_enabled", value: false },
]).onConflictDoNothing();

console.log("Seeded Coast Bookings roles and sandbox settings.");
