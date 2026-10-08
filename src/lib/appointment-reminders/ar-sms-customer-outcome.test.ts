import { describe, expect, it } from "vitest";
import { resolveArCustomerResponseSummary, arSmsOutcomeTimelineType } from "./ar-sms-customer-outcome";
import type { AppointmentMetadata } from "@/lib/appointments/types";

describe("resolveArCustomerResponseSummary", () => {
  const startsAt = "2026-10-15T17:00:00.000Z";

  it("returns confirmed when outcome event exists", () => {
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-08T12:00:00.000Z",
          type: arSmsOutcomeTimelineType("confirmed"),
          label: "Customer confirmed attendance",
          detail: "confirmation_sent",
        },
      ],
    };
    const summary = resolveArCustomerResponseSummary({
      status: "confirmed",
      startsAt,
      timezone: "America/New_York",
      metadata: meta,
    });
    expect(summary.kind).toBe("confirmed");
    expect(summary.label).toBe("Confirmed");
  });

  it("returns rescheduled with new time detail from outcome", () => {
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-08T13:00:00.000Z",
          type: arSmsOutcomeTimelineType("rescheduled"),
          label: "Customer rescheduled appointment",
          detail: `reminder_120m_sent | ${startsAt}`,
        },
      ],
    };
    const summary = resolveArCustomerResponseSummary({
      status: "scheduled",
      startsAt,
      timezone: "UTC",
      metadata: meta,
    });
    expect(summary.kind).toBe("rescheduled");
    expect(summary.detailLine).toMatch(/Now/);
  });

  it("returns none when no customer action", () => {
    const summary = resolveArCustomerResponseSummary({
      status: "scheduled",
      startsAt,
      metadata: { timeline: [{ at: "2026-10-01T00:00:00Z", type: "confirmation_sent", label: "Sent" }] },
    });
    expect(summary.kind).toBe("none");
  });
});
