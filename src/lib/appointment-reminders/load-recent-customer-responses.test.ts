import { describe, expect, it } from "vitest";
import { resolveArCustomerResponseSummary, arSmsOutcomeTimelineType } from "./ar-sms-customer-outcome";

describe("overview customer response kinds", () => {
  it("surfaces confirmed outcome from timeline", () => {
    const summary = resolveArCustomerResponseSummary({
      status: "confirmed",
      startsAt: "2026-10-14T12:00:00.000Z",
      timezone: "America/New_York",
      metadata: {
        timeline: [
          {
            at: "2026-10-09T15:00:00.000Z",
            type: arSmsOutcomeTimelineType("confirmed"),
            label: "Customer confirmed attendance",
          },
        ],
      },
    });
    expect(summary.kind).toBe("confirmed");
    expect(summary.at).toBeTruthy();
    expect(summary.detailLine).toContain("Appointment on");
  });
});
