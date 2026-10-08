import { describe, expect, it } from "vitest";
import {
  formatSnapshotForContextAgentUserMessage,
  type ArSmsSharedTurnSnapshotFields,
} from "./ar-sms-snapshot-format";

function minimalSnapshot(overrides?: Partial<ArSmsSharedTurnSnapshotFields>): ArSmsSharedTurnSnapshotFields {
  return {
    latestCustomerMessage: "Thanks!",
    conversationHistory: [
      { role: "assistant", content: "Your appointment is Monday at 1pm." },
      { role: "user", content: "Thanks!" },
    ],
    verifiedContextBlock: "appointment_id=appt_1",
    relatedAppointmentsSummary: "",
    ...overrides,
  };
}

describe("formatSnapshotForContextAgentUserMessage", () => {
  it("includes full history and latest message for context agent", () => {
    const text = formatSnapshotForContextAgentUserMessage(minimalSnapshot());
    expect(text).toContain("Latest customer message");
    expect(text).toContain("Thanks!");
    expect(text).toContain("Monday at 1pm");
    expect(text).toContain("appointment_id=appt_1");
  });

  it("uses same snapshot fields appointment agent receives via run-turn", () => {
    const snapshot = minimalSnapshot({
      latestCustomerMessage: "Can we move it to Friday?",
      conversationHistory: [
        { role: "user", content: "Can we move it to Friday?" },
      ],
    });
    const formatted = formatSnapshotForContextAgentUserMessage(snapshot);
    expect(formatted).toContain("Can we move it to Friday?");
    expect(snapshot.conversationHistory).toHaveLength(1);
    expect(snapshot.latestCustomerMessage).toBe("Can we move it to Friday?");
  });
});
