import { describe, expect, it } from "vitest";
import {
  isEventEligibleForCalendarMirror,
  isEventEligibleForReminderImport,
  mergeImportRules,
} from "./eligibility";
import type { ProviderCalendarEvent } from "./providers";

const baseEvent: ProviderCalendarEvent = {
  id: "evt-1",
  summary: "Test",
  start: new Date("2026-10-14T12:00:00Z"),
  end: new Date("2026-10-14T12:30:00Z"),
  status: "confirmed",
  attendees: [],
  organizerEmail: "owner@example.com",
};

describe("calendar mirror vs reminder eligibility", () => {
  it("imports solo personal events for calendar mirror", () => {
    const mirror = isEventEligibleForCalendarMirror(baseEvent);
    expect(mirror.eligible).toBe(true);

    const reminder = isEventEligibleForReminderImport(baseEvent, mergeImportRules({}), "owner@example.com");
    expect(reminder.eligible).toBe(false);
    expect(reminder.reason).toBe("no_external_attendees");
  });

  it("skips transovo-marked events from mirror import", () => {
    const event = { ...baseEvent, transovoOriginated: true };
    const mirror = isEventEligibleForCalendarMirror(event);
    expect(mirror.eligible).toBe(false);
    expect(mirror.reason).toBe("transovo_originated");
  });
});
