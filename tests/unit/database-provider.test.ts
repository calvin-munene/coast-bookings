import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/lib/env";

describe("database provider selection", () => {
  it("uses Replit's injected DATABASE_URL by default", () => {
    expect(getDatabaseUrl({ DATABASE_PROVIDER: "replit", DATABASE_URL: "postgresql://replit", SUPABASE_DATABASE_URL: undefined })).toBe("postgresql://replit");
  });

  it("uses a separate Supabase URL when selected", () => {
    expect(getDatabaseUrl({ DATABASE_PROVIDER: "supabase", DATABASE_URL: "postgresql://replit", SUPABASE_DATABASE_URL: "postgresql://supabase" })).toBe("postgresql://supabase");
  });

  it("fails clearly when the selected provider has no URL", () => {
    expect(() => getDatabaseUrl({ DATABASE_PROVIDER: "supabase", DATABASE_URL: "postgresql://replit", SUPABASE_DATABASE_URL: undefined })).toThrow("SUPABASE_DATABASE_URL");
  });
});
