import { describe, expect, it } from "vitest";
import { IcalAvailabilityAdapter } from "@/modules/integrations/channel-manager";

describe("iCal adapter", () => {
  it("exports blocked dates without exposing guest details", async () => {
    const calendar = await new IcalAvailabilityAdapter().exportCalendar("unit-1", [{ uid: "hold-1", startsOn: "2026-08-01", endsOn: "2026-08-04" }]);
    expect(calendar).toContain("DTSTART;VALUE=DATE:20260801");
    expect(calendar).toContain("SUMMARY:Unavailable");
    expect(calendar).not.toContain("guest");
  });
});
