import { describe, expect, it } from "vitest";
import {
  evaluateArRescheduleSmsCutoff,
  resolveArRescheduleSmsCutoffMinutes,
} from "./reschedule-sms-cutoff";
import {
  arReplyInstructionsSuffixForAppointment,
  AR_REPLY_INSTRUCTIONS_CONFIRM_CANCEL,
  AR_REPLY_INSTRUCTIONS_SUFFIX,
  DEFAULT_AI_RESCHEDULER_CONFIG,
} from "./types";

describe("evaluateArRescheduleSmsCutoff", () => {
  const startsAt = new Date("2026-10-20T17:00:00.000Z");

  it("allows reschedule when cutoff is 0", () => {
    const now = new Date("2026-10-20T16:00:00.000Z");
    expect(
      evaluateArRescheduleSmsCutoff({ startsAt, cutoffMinutes: 0, now }).allowed,
    ).toBe(true);
  });

  it("blocks when inside 24h window", () => {
    const now = new Date("2026-10-19T18:00:00.000Z"); // 23h before
    const r = evaluateArRescheduleSmsCutoff({ startsAt, cutoffMinutes: 1440, now });
    expect(r.allowed).toBe(false);
  });

  it("allows when outside 24h window", () => {
    const now = new Date("2026-10-19T16:00:00.000Z"); // 25h before
    expect(
      evaluateArRescheduleSmsCutoff({ startsAt, cutoffMinutes: 1440, now }).allowed,
    ).toBe(true);
  });
});

describe("arReplyInstructionsSuffixForAppointment", () => {
  const startsAt = new Date("2026-10-20T17:00:00.000Z");

  it("omits R in suffix inside cutoff", () => {
    const suffix = arReplyInstructionsSuffixForAppointment({
      config: { ...DEFAULT_AI_RESCHEDULER_CONFIG, rescheduleSmsCutoffMinutes: 1440 },
      startsAt,
      now: new Date("2026-10-20T10:00:00.000Z"),
    });
    expect(suffix).toContain("Contact the business to reschedule");
    expect(suffix).not.toMatch(/\bR to reschedule\b/);
  });

  it("includes R outside cutoff", () => {
    const suffix = arReplyInstructionsSuffixForAppointment({
      config: { ...DEFAULT_AI_RESCHEDULER_CONFIG, rescheduleSmsCutoffMinutes: 1440 },
      startsAt,
      now: new Date("2026-10-18T10:00:00.000Z"),
    });
    expect(suffix).toBe(AR_REPLY_INSTRUCTIONS_SUFFIX);
  });
});

describe("resolveArRescheduleSmsCutoffMinutes", () => {
  it("treats missing as 0", () => {
    expect(resolveArRescheduleSmsCutoffMinutes(DEFAULT_AI_RESCHEDULER_CONFIG)).toBe(0);
  });
});
