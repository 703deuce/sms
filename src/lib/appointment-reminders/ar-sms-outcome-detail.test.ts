import { describe, expect, it } from "vitest";
import { buildArSmsOutcomeDetail, parseArSmsOutcomeDetail } from "./ar-sms-outcome-detail";

describe("ar-sms-outcome-detail", () => {
  it("round-trips note and reschedule time", () => {
    const detail = buildArSmsOutcomeDetail({
      reminderTimelineType: "reminder_120m_sent",
      note: 'Customer texted: "Can we move to Friday?"',
      newStartsAtIso: "2026-10-17T13:00:00.000Z",
    });
    const parsed = parseArSmsOutcomeDetail(detail);
    expect(parsed.reminderTimelineType).toBe("reminder_120m_sent");
    expect(parsed.note).toContain("Friday");
    expect(parsed.newStartsAtIso).toBe("2026-10-17T13:00:00.000Z");
  });
});
