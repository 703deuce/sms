import { describe, expect, it } from "vitest";
import { inferArSmsOutcomesForBackfill } from "./ar-sms-outcome-backfill";
import { arSmsOutcomeTimelineType } from "./ar-sms-customer-outcome";
import type { AppointmentMetadata } from "@/lib/appointments/types";

describe("inferArSmsOutcomesForBackfill", () => {
  it("infers confirmed from arCustomerConfirmedAt", () => {
    const meta: AppointmentMetadata = {
      arCustomerConfirmedAt: "2026-10-01T15:00:00.000Z",
      confirmationSource: "sms_reminder",
      timeline: [{ at: "2026-09-30T10:00:00.000Z", type: "confirmation_sent", label: "Confirmation sent" }],
    };
    const inferred = inferArSmsOutcomesForBackfill({
      metadata: meta,
      status: "confirmed",
      startsAt: new Date("2026-10-15T17:00:00.000Z"),
      sessions: [
        {
          id: "sess1",
          timelineType: "confirmation_sent",
          lifecycleState: "COMPLETED",
          conversationId: null,
          createdAt: new Date("2026-09-30T10:00:00.000Z"),
          completedAt: new Date("2026-10-01T15:00:00.000Z"),
          lastUsedAt: new Date("2026-10-01T15:00:00.000Z"),
        },
      ],
    });
    expect(inferred.some((i) => i.outcome === "confirmed")).toBe(true);
    expect(inferred[0]?.reminderTimelineType).toBe("confirmation_sent");
  });

  it("skips when outcome already on timeline", () => {
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-01T15:00:00.000Z",
          type: arSmsOutcomeTimelineType("confirmed"),
          label: "Customer confirmed attendance",
          detail: "confirmation_sent | Confirmed via SMS",
        },
      ],
      arCustomerConfirmedAt: "2026-10-01T15:00:00.000Z",
    };
    const inferred = inferArSmsOutcomesForBackfill({
      metadata: meta,
      status: "confirmed",
      startsAt: new Date(),
      sessions: [],
    });
    expect(inferred).toHaveLength(0);
  });

  it("infers rescheduled from legacy rescheduled timeline event", () => {
    const meta: AppointmentMetadata = {
      timeline: [
        {
          at: "2026-10-02T12:00:00.000Z",
          type: "rescheduled",
          label: "Rescheduled via Appointment Reminders SMS",
          detail: "2026-10-20T18:00:00.000Z",
        },
      ],
    };
    const inferred = inferArSmsOutcomesForBackfill({
      metadata: meta,
      status: "scheduled",
      startsAt: new Date("2026-10-20T18:00:00.000Z"),
      sessions: [],
    });
    expect(inferred.some((i) => i.outcome === "rescheduled")).toBe(true);
    expect(inferred.find((i) => i.outcome === "rescheduled")?.newStartsAtIso).toContain("2026-10-20");
  });
});
