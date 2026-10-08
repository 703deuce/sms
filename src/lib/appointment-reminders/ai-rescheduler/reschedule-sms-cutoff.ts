import type { AiReschedulerConfig } from "./types";

export type ArRescheduleSmsCutoffResult = {
  allowed: boolean;
  minutesUntilStart: number;
  cutoffMinutes: number;
};

/**
 * Whether the customer may start or be offered SMS reschedule (R) for this appointment.
 * When cutoffMinutes is 0, reschedule is always allowed (legacy / unset).
 */
export function evaluateArRescheduleSmsCutoff(input: {
  startsAt: Date;
  cutoffMinutes: number;
  now?: Date;
}): ArRescheduleSmsCutoffResult {
  const now = input.now ?? new Date();
  const cutoffMinutes = Math.max(0, Math.floor(input.cutoffMinutes || 0));
  const minutesUntilStart = (input.startsAt.getTime() - now.getTime()) / 60_000;
  if (cutoffMinutes <= 0) {
    return { allowed: true, minutesUntilStart, cutoffMinutes };
  }
  return {
    allowed: minutesUntilStart > cutoffMinutes,
    minutesUntilStart,
    cutoffMinutes,
  };
}

export function resolveArRescheduleSmsCutoffMinutes(config: AiReschedulerConfig): number {
  const raw = config.rescheduleSmsCutoffMinutes;
  if (raw === undefined || raw === null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
