import { describe, expect, it } from "vitest";
import { sha256 } from "@/modules/payments/crypto";

describe("payment webhook identity", () => {
  it("creates a stable payload hash for idempotent records", async () => {
    const first = await sha256('{"transaction":"ABC"}');
    const second = await sha256('{"transaction":"ABC"}');
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
