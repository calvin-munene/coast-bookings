import { describe, expect, it } from "vitest";
import { can } from "@/modules/permissions/service";

describe("permissions", () => {
  it("does not let co-hosts change payout accounts", () => expect(can({ userId: "cohost", roles: ["CO_HOST"], propertyIds: ["p1"] }, "payout_account.manage", "p1")).toBe(false));
  it("scopes host property permissions", () => {
    const host = { userId: "host", roles: ["HOST"] as const, propertyIds: ["p1"] };
    expect(can(host, "inventory.manage", "p1")).toBe(true);
    expect(can(host, "inventory.manage", "p2")).toBe(false);
  });
  it("lets finance approve payouts but not manage properties", () => {
    const finance = { userId: "staff", roles: ["FINANCE_OFFICER"] as const };
    expect(can(finance, "payout.approve")).toBe(true);
    expect(can(finance, "property.manage")).toBe(false);
  });
});
