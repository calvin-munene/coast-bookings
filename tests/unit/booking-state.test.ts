import { describe, expect, it } from "vitest";
import { allowedBookingTransitions, assertBookingTransition } from "@/modules/bookings/state-machine";

describe("booking state machine", () => {
  it("does not confirm from a browser redirect without verified payment", () => expect(() => assertBookingTransition("PAYMENT_PROCESSING", "CONFIRMED", { actor: "SYSTEM", paymentVerified: false })).toThrow("verified payment"));
  it("allows verified confirmation", () => expect(() => assertBookingTransition("PAYMENT_PROCESSING", "CONFIRMED", { actor: "SYSTEM", paymentVerified: true })).not.toThrow());
  it("rejects arbitrary transitions", () => expect(() => assertBookingTransition("DRAFT", "COMPLETED", { actor: "STAFF" })).toThrow("cannot transition"));
  it("exposes controlled transitions", () => expect(allowedBookingTransitions("PENDING_HOST_APPROVAL")).toContain("HOST_DECLINED"));
});
