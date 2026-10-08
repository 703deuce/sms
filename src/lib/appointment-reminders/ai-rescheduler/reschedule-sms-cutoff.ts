import type { AiReschedulerConfig } from "./types";
import {
  evaluateArSmsActionPolicy,
  resolveArRescheduleSmsPolicy,
} from "./ar-sms-action-policy";

export type ArRescheduleSmsCutoffResult = {
  allowed: boolean;
  minutesUntilStart: number;
  cutoffMinutes: number;
};

/** @deprecated Use evaluateArSmsActionPolicy — kept for existing imports. */
export function evaluateArRescheduleSmsCutoff(input: {
  startsAt: Date;
  cutoffMinutes: number;
  now?: Date;
}): ArRescheduleSmsCutoffResult {
  const evalResult = evaluateArSmsActionPolicy({
    action: "reschedule",
    startsAt: input.startsAt,
    now: input.now,
    policy: {
      cutoffMinutes: input.cutoffMinutes,
      afterCutoff: "contact_business",
    },
  });
  return {
    allowed: evalResult.allowsAutomatedAction && !evalResult.insideCutoff,
    minutesUntilStart: evalResult.minutesUntilStart,
    cutoffMinutes: evalResult.cutoffMinutes,
  };
}

export function resolveArRescheduleSmsCutoffMinutes(config: AiReschedulerConfig): number {
  return resolveArRescheduleSmsPolicy(config).cutoffMinutes ?? 0;
}
