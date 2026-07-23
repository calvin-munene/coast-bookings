import { describe, expect, it } from "vitest";
import { renderNotification } from "@/modules/notifications/content";

describe("transactional notification content", () => {
  it("renders a booking confirmation without exposing internal IDs", () => {
    const content = renderNotification("BOOKING_CONFIRMED", { reference: "CB-2026-0001", bookingId: "private-id" });
    expect(content.subject).toContain("confirmed");
    expect(content.text).toContain("CB-2026-0001");
    expect(content.text).not.toContain("private-id");
    expect(content.actionPath).toBe("/guest/upcoming-stays");
  });

  it("uses a safe generic message for new event types", () => {
    const content = renderNotification("DOCUMENT_EXPIRING", {});
    expect(content.subject).toBe("Coast Bookings update");
    expect(content.actionPath).toMatch(/^\//);
  });
});
