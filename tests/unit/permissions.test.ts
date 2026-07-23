import { describe, expect, it } from "vitest";
import {
  isActivePolicyUser,
  isCurrentMembership,
  isOwnGuestResource,
  isPublicRegistrationRole,
  isSameTenantResource,
  mayEnterGuest,
  mayEnterHost,
  mayEnterInternal,
  mayUseInternalPermission,
  sensitiveActionRequiresReverification,
  type PolicyMembership,
  type PolicyUser,
} from "@/modules/authorization/policy";
import { isPublicPath, PUBLIC_NAVIGATION_PATHS } from "@/modules/auth/route-policy";
import { toGuestBookingDTO } from "@/modules/dto/guest";
import { toHostBookingDTO } from "@/modules/dto/host";
import { toPublicPropertyDTO } from "@/modules/dto/public";
import { webhookEvents } from "@/db/schema";

const activeUser: PolicyUser = { id: "user-1", status: "ACTIVE", mfaEnabled: true };
const guestUser: PolicyUser = { ...activeUser, mfaEnabled: false };
const hostMembership: PolicyMembership = { organizationId: "host-1", organizationType: "HOST", organizationStatus: "ACTIVE", roleKey: "org:owner", expiresAt: null };
const internalMembership: PolicyMembership = { organizationId: "internal-1", organizationType: "INTERNAL", organizationStatus: "ACTIVE", roleKey: "org:customer_support", expiresAt: null };

describe("authorization acceptance rules", () => {
  it("1. protects guest, host, staff, and admin routes from unauthenticated access", () => {
    for (const path of ["/guest/dashboard", "/host/dashboard", "/staff/dashboard", "/admin/dashboard"]) expect(isPublicPath(path)).toBe(false);
  });
  it("2. denies guests access to host routes", () => expect(mayEnterHost(guestUser, null)).toBe(false));
  it("3. denies guests access to operations", () => expect(mayEnterInternal(guestUser, null, "internal-1")).toBe(false));
  it("4. denies hosts access to operations", () => expect(mayEnterInternal(activeUser, hostMembership, "internal-1")).toBe(false));
  it("5. denies a host another organization's property", () => expect(isSameTenantResource("host-2", hostMembership)).toBe(false));
  it("6. denies a host another organization's booking", () => expect(isSameTenantResource("host-2", hostMembership)).toBe(false));
  it("7. denies a guest another guest's booking", () => expect(isOwnGuestResource("user-2", guestUser)).toBe(false));
  it("8. prevents support staff from approving payouts", () => expect(mayUseInternalPermission(internalMembership, "internal:payouts:approve")).toBe(false));
  it("9. prevents reservations staff from managing roles", () => expect(mayUseInternalPermission({ ...internalMembership, roleKey: "org:reservations" }, "internal:roles:manage")).toBe(false));
  it("10. prevents finance staff from approving hosts", () => expect(mayUseInternalPermission({ ...internalMembership, roleKey: "org:finance" }, "internal:hosts:verify")).toBe(false));
  it("11. strips internal fields from public, guest, and host DTOs", () => {
    const publicDto = toPublicPropertyDTO({ id: "p1", slug: "stay", name: "Stay", description: "Safe", destination: "Diani", county: "Kwale", category: "B&B", imageUrl: null, verified: true, lowestNightlyRateMinor: 10000, currency: "KES", internalNotes: "never", riskFlags: ["x"] });
    const guestDto = toGuestBookingDTO({ id: "b1", reference: "CB1", propertyName: "Stay", status: "CONFIRMED", paymentStatus: "SUCCEEDED", checkIn: "2026-01-01", checkOut: "2026-01-02", guestTotalMinor: 10000, currency: "KES", commissionMinor: 1000, internalNotes: "never" });
    const hostDto = toHostBookingDTO({ id: "b1", reference: "CB1", guestDisplayName: "Guest", status: "CONFIRMED", checkIn: "2026-01-01", checkOut: "2026-01-02", unitCount: 1, expectedEarningsMinor: 9000, currency: "KES", internalMarginMinor: 1000, internalNotes: "never" });
    for (const dto of [publicDto, guestDto, hostDto]) expect(JSON.stringify(dto)).not.toMatch(/internal|riskFlags|commissionMinor/);
  });
  it("12. ignores a tampered organization parameter that differs from the active tenant", () => expect(isSameTenantResource("attacker-selected-org", hostMembership)).toBe(false));
  it("13. removes access from suspended accounts", () => expect(isActivePolicyUser({ ...activeUser, status: "SUSPENDED" })).toBe(false));
  it("14. removes access from expired memberships", () => expect(isCurrentMembership({ ...hostMembership, expiresAt: new Date("2020-01-01") }, new Date("2026-01-01"))).toBe(false));
  it("15. relies on a stable provider event ID for webhook idempotency", () => {
    expect(webhookEvents.providerEventId.notNull).toBe(true);
  });
  it("16. marks sensitive internal actions for reverification", () => {
    for (const permission of ["internal:roles:manage", "internal:payouts:approve", "internal:refunds:approve", "internal:settings:manage"] as const) expect(sensitiveActionRequiresReverification(permission)).toBe(true);
  });
  it("17. prevents staff and administrator roles in public registration", () => { expect(isPublicRegistrationRole("guest")).toBe(true); expect(isPublicRegistrationRole("host")).toBe(true); expect(isPublicRegistrationRole("org:super_admin")).toBe(false); });
  it("18. excludes internal routes from public navigation", () => expect(PUBLIC_NAVIGATION_PATHS.every((path) => !path.startsWith("/staff") && !path.startsWith("/admin"))).toBe(true));
  it("allows an active guest to enter the guest portal", () => expect(mayEnterGuest(guestUser, null)).toBe(true));
  it("allows an active host only in its approved organization context", () => expect(mayEnterHost(activeUser, hostMembership)).toBe(true));
  it("requires MFA and the configured internal organization", () => { expect(mayEnterInternal(activeUser, internalMembership, "internal-1")).toBe(true); expect(mayEnterInternal({ ...activeUser, mfaEnabled: false }, internalMembership, "internal-1")).toBe(false); expect(mayEnterInternal(activeUser, internalMembership, "other")).toBe(false); });
});
