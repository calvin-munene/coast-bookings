import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("server-only", () => ({}));

import {
  AccountRestrictedError,
  ForbiddenError,
  OrganizationContextRequiredError,
  UnauthenticatedError,
} from "@/modules/authorization/errors";
import { guardPage } from "@/modules/authorization/page-guards";

describe("protected page error handling", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("returns the typed authorization context after a successful check", async () => {
    const context = { userId: "user-1" } as const;
    await expect(guardPage(async () => context)).resolves.toBe(context);
  });

  it.each([
    [new UnauthenticatedError(), "/sign-in"],
    [new AccountRestrictedError(), "/account-restricted"],
    [new OrganizationContextRequiredError(), "/auth/continue"],
    [new ForbiddenError(), "/account-restricted"],
  ])("converts %s into a controlled redirect", async (error, destination) => {
    await expect(guardPage(async () => { throw error; })).rejects.toThrow(`REDIRECT:${destination}`);
    expect(redirect).toHaveBeenCalledWith(destination);
  });
});
