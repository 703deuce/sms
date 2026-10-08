import { describe, expect, it } from "vitest";
import {
  arSmsOutcomeTimelineType,
  listArSmsOutcomeEvents,
  resolveArCustomerResponseSummary,
} from "./ar-sms-customer-outcome";
import type { AppointmentMetadata } from "@/lib/appointments/types";

describe("AR SMS integration boundaries (621 + 622)", () => {
  it("uses latest verified reschedule for list summary after multiple operations", () => {
    const first = "2026-10-12T17:00:00.000Z";
    const second = "2026-10-19T17:00:00.000Z";
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-08T10:00:00.000Z",
          type: arSmsOutcomeTimelineType("rescheduled"),
          label: "Customer rescheduled appointment",
          detail: `reminder_1440m_sent | first move | ${first}`,
        },
        {
          at: "2026-10-09T11:00:00.000Z",
          type: arSmsOutcomeTimelineType("rescheduled"),
          label: "Customer rescheduled appointment",
          detail: `reminder_1440m_sent | second move | ${second}`,
        },
      ],
    };
    const summary = resolveArCustomerResponseSummary({
      status: "scheduled",
      startsAt: second,
      timezone: "UTC",
      metadata: meta,
    });
    expect(summary.kind).toBe("rescheduled");
    expect(summary.detailLine).toContain("Oct 19");
    expect(listArSmsOutcomeEvents(meta)).toHaveLength(2);
  });

  it("does not treat cancel_pending as cancelled", () => {
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-08T12:00:00.000Z",
          type: arSmsOutcomeTimelineType("cancel_pending"),
          label: "Customer requested cancellation",
          detail: 'confirmation_sent | Customer texted: "I need to cancel"',
        },
      ],
    };
    const summary = resolveArCustomerResponseSummary({
      status: "scheduled",
      startsAt: new Date().toISOString(),
      metadata: meta,
    });
    expect(summary.kind).toBe("cancel_pending");
    expect(summary.label).not.toMatch(/cancelled by customer/i);
  });
});
