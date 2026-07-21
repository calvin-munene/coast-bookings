export type CalendarBlock = Readonly<{ uid: string; startsOn: string; endsOn: string; summary?: string }>;

export interface AvailabilityChannelAdapter {
  readonly provider: string;
  importBlocks(feedUrl: string): Promise<readonly CalendarBlock[]>;
  exportCalendar(unitId: string, blocks: readonly CalendarBlock[]): Promise<string>;
}

/** Escapes the minimal RFC 5545 characters needed by an iCal export. */
function escapeIcal(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export class IcalAvailabilityAdapter implements AvailabilityChannelAdapter {
  readonly provider = "ICAL";

  async importBlocks(): Promise<readonly CalendarBlock[]> {
    throw new Error("Remote iCal imports run in a background job with SSRF-safe URL validation");
  }

  async exportCalendar(unitId: string, blocks: readonly CalendarBlock[]): Promise<string> {
    const events = blocks.map((block) => [
      "BEGIN:VEVENT", `UID:${escapeIcal(block.uid)}`, `DTSTART;VALUE=DATE:${block.startsOn.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${block.endsOn.replaceAll("-", "")}`, `SUMMARY:${escapeIcal(block.summary ?? "Unavailable")}`, "END:VEVENT",
    ].join("\r\n"));
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Coast Bookings//Availability//EN", `X-WR-CALNAME:${escapeIcal(unitId)}`, ...events, "END:VCALENDAR", ""].join("\r\n");
  }
}
