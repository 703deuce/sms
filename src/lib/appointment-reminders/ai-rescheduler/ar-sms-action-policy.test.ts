import { describe, expect, it } from "vitest";
import {
  buildArReplyInstructionsSuffix,
  evaluateArSmsActionPolicy,
  formatArSmsPenaltySummary,
  resolveArCancelSmsPolicy,
  resolveArRescheduleSmsPolicy,
} from "./ar-sms-action-policy";
import { DEFAULT_AI_RESCHEDULER_CONFIG } from "./types";

const startsAt = new Date("2026-10-20T17:00:00.000Z");

describe("evaluateArSmsActionPolicy", () => {
  it("allows automated action outside cutoff", () => {
    const r = evaluateArSmsActionPolicy({
      action: "reschedule",
      startsAt,
      now: new Date("2026-10-18T10:00:00.000Z"),
      policy: { cutoffMinutes: 1440, afterCutoff: "contact_business" },
    });
    expect(r.insideCutoff).toBe(false);
    expect(r.allowsAutomatedAction).toBe(true);
  });

  it("blocks automated reschedule inside cutoff when contact business", () => {
    const r = evaluateArSmsActionPolicy({
      action: "reschedule",
      startsAt,
      now: new Date("2026-10-20T10:00:00.000Z"),
      policy: { cutoffMinutes: 1440, afterCutoff: "contact_business" },
    });
    expect(r.insideCutoff).toBe(true);
    expect(r.allowsAutomatedAction).toBe(false);
  });

  it("allows late cancel with warning when configured", () => {
    const r = evaluateArSmsActionPolicy({
      action: "cancel",
      startsAt,
      now: new Date("2026-10-20T10:00:00.000Z"),
      policy: {
        cutoffMinutes: 1440,
        afterCutoff: "allow_with_warning",
        penaltyType: "lost_session",
      },
    });
    expect(r.allowsAutomatedAction).toBe(true);
    expect(r.requiresPolicyWarning).toBe(true);
    expect(r.penaltySummary).toMatch(/prepaid session/i);
  });

  it("independent cancel vs reschedule cutoffs", () => {
    const config = {
      ...DEFAULT_AI_RESCHEDULER_CONFIG,
      rescheduleSmsPolicy: { cutoffMinutes: 1440, afterCutoff: "contact_business" },
      cancelSmsPolicy: { cutoffMinutes: 720, afterCutoff: "allow" },
    };
    const now = new Date("2026-10-19T20:00:00.000Z"); // 21h before
    const reschedule = evaluateArSmsActionPolicy({
      action: "reschedule",
      startsAt,
      now,
      policy: resolveArRescheduleSmsPolicy(config),
    });
    const cancel = evaluateArSmsActionPolicy({
      action: "cancel",
      startsAt,
      now,
      policy: resolveArCancelSmsPolicy(config),
    });
    expect(reschedule.insideCutoff).toBe(true);
    expect(reschedule.allowsAutomatedAction).toBe(false);
    expect(cancel.insideCutoff).toBe(false);
    expect(cancel.allowsAutomatedAction).toBe(true);
  });
});

describe("buildArReplyInstructionsSuffix", () => {
  it("omits R when reschedule requires contacting business", () => {
    const suffix = buildArReplyInstructionsSuffix({
      config: {
        ...DEFAULT_AI_RESCHEDULER_CONFIG,
        rescheduleSmsCutoffMinutes: 1440,
        rescheduleSmsPolicy: { cutoffMinutes: 1440, afterCutoff: "contact_business" },
      },
      startsAt,
      now: new Date("2026-10-20T10:00:00.000Z"),
    });
    expect(suffix).toContain("Contact the business to reschedule");
    expect(suffix).not.toMatch(/\bR to reschedule\b/);
  });

  it("keeps full suffix when both actions available", () => {
    const suffix = buildArReplyInstructionsSuffix({
      config: DEFAULT_AI_RESCHEDULER_CONFIG,
      startsAt,
      now: new Date("2026-10-18T10:00:00.000Z"),
    });
    expect(suffix).toContain("R to reschedule");
    expect(suffix).toContain("X to cancel");
  });
});

describe("formatArSmsPenaltySummary", () => {
  it("formats percent penalty", () => {
    expect(
      formatArSmsPenaltySummary({
        penaltyType: "percent_of_price",
        penaltyPercent: 50,
      }),
    ).toContain("50%");
  });

  it("returns null when no penalty", () => {
    expect(formatArSmsPenaltySummary({ penaltyType: "none" })).toBeNull();
  });
});
