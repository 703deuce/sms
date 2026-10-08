import { describe, expect, it } from "vitest";
import { buildArSmsOutcomeDetail, parseArSmsOutcomeDetail } from "./ar-sms-outcome-detail";

describe("ar-sms-outcome-detail", () => {
  it("round-trips structured SMS evidence JSON", () => {
    const detail = buildArSmsOutcomeDetail({
      reminderTimelineType: "reminder_1440m_sent",
      evidence: {
        channel: "sms",
        direction: "outbound",
        messageText: "Because you're cancelling within 24 hours, this will count as one prepaid session.",
        providerMessageId: "msg_out_1",
        operationId: "op_1",
        consequenceLabel: "One prepaid session",
        action: "cancel",
      },
    });
    const parsed = parseArSmsOutcomeDetail(detail);
    expect(parsed.evidence?.messageText).toContain("prepaid session");
    expect(parsed.evidence?.providerMessageId).toBe("msg_out_1");
  });

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
