import type { VoiceV3CallClock } from "./call-clock";
import { schedulingMeaningHasSignal } from "./scheduling-normalizer";
import type { NormalizedSchedulingPreference, SchedulingMeaning, SchedulingWeekday } from "./scheduling-types";

export type SchedulingClarificationReason =
  | "SAME_WEEKDAY_AMBIGUOUS"
  | "DATE_UNRESOLVED"
  | "TIME_UNRESOLVED"
  | "SCHEDULING_UNRESOLVED";

export interface SchedulingClarificationRequirement {
  required: boolean;
  reason: SchedulingClarificationReason | null;
  /** Deterministic caller-facing question — Live must use this (or close paraphrase), not invent availability. */
  prompt: string | null;
}

function weekdayLabelFromEnum(weekday: SchedulingWeekday): string {
  const lower = weekday.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function isSameWeekdayAsClock(meaning: SchedulingMeaning, clock: VoiceV3CallClock): boolean {
  if (!meaning.weekday) return false;
  const label = weekdayLabelFromEnum(meaning.weekday);
  return clock.localWeekday.toLowerCase() === label.toLowerCase();
}

/**
 * When normalization is UNRESOLVED but the caller expressed scheduling intent,
 * application rules require a clarification turn before any calendar action.
 */
export function deriveSchedulingClarification(input: {
  meaning: SchedulingMeaning | null | undefined;
  normalized: NormalizedSchedulingPreference | null | undefined;
  clock: VoiceV3CallClock;
}): SchedulingClarificationRequirement {
  const { meaning, normalized, clock } = input;
  if (!meaning || !schedulingMeaningHasSignal(meaning)) {
    return { required: false, reason: null, prompt: null };
  }
  if (normalized && normalized.precision !== "UNRESOLVED") {
    return { required: false, reason: null, prompt: null };
  }

  if (meaning.date_relation === "THIS_WEEKDAY" && isSameWeekdayAsClock(meaning, clock)) {
    const day = weekdayLabelFromEnum(meaning.weekday!);
    return {
      required: true,
      reason: "SAME_WEEKDAY_AMBIGUOUS",
      prompt: `Do you mean today, or next ${day}?`,
    };
  }

  if (!normalized?.localDate && meaning.date_relation !== "UNSPECIFIED") {
    return {
      required: true,
      reason: "DATE_UNRESOLVED",
      prompt: "Which day did you have in mind?",
    };
  }

  const timeSignal =
    meaning.time_kind !== "UNSPECIFIED" &&
    meaning.time_kind !== "ANYTIME" &&
    Boolean(meaning.time_expression?.trim());

  if (normalized?.localDate && timeSignal) {
    return {
      required: true,
      reason: "TIME_UNRESOLVED",
      prompt: "What time were you thinking?",
    };
  }

  return {
    required: true,
    reason: "SCHEDULING_UNRESOLVED",
    prompt: "Can you clarify the day and time you were hoping for?",
  };
}
