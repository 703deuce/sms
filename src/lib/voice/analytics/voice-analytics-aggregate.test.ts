import { describe, expect, it } from "vitest";
import { countTransfersAnsweredOnCall } from "../calls/outcome-classification";
import { aggregateReceptionistCalls, isReceptionistAnalyticsCall } from "./voice-analytics-aggregate";

const base = {
  id: "c1",
  startedAt: new Date("2026-01-15T18:00:00.000Z"),
  direction: "INBOUND",
  isTest: false,
  status: "COMPLETED",
};

describe("isReceptionistAnalyticsCall", () => {
  it("includes non-test inbound", () => {
    expect(isReceptionistAnalyticsCall({ isTest: false, direction: "INBOUND" })).toBe(true);
  });
  it("excludes outbound campaign calls", () => {
    expect(isReceptionistAnalyticsCall({ isTest: false, direction: "OUTBOUND" })).toBe(false);
  });
  it("excludes test calls", () => {
    expect(isReceptionistAnalyticsCall({ isTest: true, direction: "INBOUND" })).toBe(false);
  });
});

describe("aggregateReceptionistCalls", () => {
  it("counts appointment booked and transfer failed on same call", () => {
    const agg = aggregateReceptionistCalls(
      [
        {
          ...base,
          appointmentBooked: true,
          outcome: "transfer_failed",
          transfers: [{ status: "failed", answered: false }],
        },
      ],
      "America/New_York",
    );
    expect(agg.appointmentsBooked).toBe(1);
    expect(agg.transfersFailedEvents).toBe(1);
    expect(agg.materialOutcomes["Appointment Booked"]).toBe(1);
    expect(agg.materialOutcomes["Transfer Failed"]).toBe(1);
  });

  it("counts callback and message outcomes", () => {
    const agg = aggregateReceptionistCalls(
      [
        { ...base, id: "a", outcome: "callback_requested" },
        { ...base, id: "b", outcome: "message_taken" },
        { ...base, id: "c", outcome: "booking_link_sent" },
      ],
      "UTC",
    );
    expect(agg.callbacksRequested).toBe(1);
    expect(agg.materialOutcomes["Message Taken"]).toBe(1);
    expect(agg.materialOutcomes["Booking Link Sent"]).toBe(1);
  });

  it("counts spam/solicitor", () => {
    const agg = aggregateReceptionistCalls(
      [{ ...base, outcome: "solicitor_blocked" }],
      "UTC",
    );
    expect(agg.materialOutcomes["Solicitor"]).toBe(1);
  });

  it("voicemail uses inbound population only", () => {
    const agg = aggregateReceptionistCalls(
      [
        { ...base, voicemailDetected: true },
        { ...base, id: "out", direction: "OUTBOUND", voicemailDetected: true },
      ],
      "UTC",
    );
    expect(agg.totalCalls).toBe(1);
    expect(agg.voicemailCount).toBe(1);
  });
});

describe("countTransfersAnsweredOnCall", () => {
  it("counts completed and answered", () => {
    expect(
      countTransfersAnsweredOnCall([
        { status: "completed", answered: true },
        { status: "completed", answered: false },
      ]),
    ).toBe(1);
  });
});
