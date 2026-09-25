import { describe, expect, it } from "vitest";
import { aggregateReceptionistCalls } from "./voice-analytics-aggregate";

describe("receptionist analytics snapshot semantics", () => {
  const base = {
    id: "c1",
    startedAt: new Date("2026-01-15T18:00:00.000Z"),
    direction: "INBOUND",
    isTest: false,
    status: "COMPLETED",
  };

  it("matches aggregateReceptionistCalls for inbound booked, callback, exclusions", () => {
    const calls = [
      { ...base, id: "in-booked", appointmentBooked: true },
      { ...base, id: "in-cb", outcome: "callback_requested" },
      { ...base, id: "out", direction: "OUTBOUND", appointmentBooked: true },
      { ...base, id: "test", isTest: true, appointmentBooked: true },
    ];
    const agg = aggregateReceptionistCalls(calls, "America/New_York");
    expect(agg.totalCalls).toBe(2);
    expect(agg.appointmentsBooked).toBe(1);
    expect(agg.callbacksRequested).toBe(1);
  });
});
