import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/lib/env";

describe("Replit database configuration", () => {
  it("uses Replit's injected DATABASE_URL", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgresql://replit" })).toBe("postgresql://replit");
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: undefined })).toThrow("Replit App");
  });
});
