import type { VoiceV3CallClock } from "../time/call-clock";
import {
  DEFAULT_SCHEDULING_POLICY,
  type NormalizedSchedulingPreference,
  type SchedulingDaypart,
  type SchedulingMeaning,
  type SchedulingPolicy,
} from "../time/scheduling-types";
import {
  normalizeSchedulingMeaning,
  schedulingMeaningHasSignal,
} from "../time/scheduling-normalizer";
import { parseHm } from "../time/timezone";

export type AppointmentWhenConstraint = {
  normalized: NormalizedSchedulingPreference | null;
  /** Local HH:MM when caller gave time without a resolvable date. */
  localTimeHm?: string;
  /** Daypart-only clue without a calendar date. */
  daypartOnly?: SchedulingDaypart;
};

export function buildAppointmentWhenFromSchedulingMeaning(
  meaning: SchedulingMeaning,
  clock: VoiceV3CallClock,
  policy: SchedulingPolicy = DEFAULT_SCHEDULING_POLICY,
): AppointmentWhenConstraint | null {
  if (!schedulingMeaningHasSignal(meaning)) return null;

  const hasDateSignal =
    meaning.date_relation !== "UNSPECIFIED" ||
    Boolean(meaning.explicit_date?.trim()) ||
    Boolean(meaning.weekday);

  const hasTimeSignal = meaning.time_kind !== "UNSPECIFIED";

  if (hasDateSignal) {
    const normalized = normalizeSchedulingMeaning(meaning, clock, policy);
    if (normalized.precision === "UNRESOLVED") {
      return { normalized };
    }
    return { normalized };
  }

  if (meaning.time_kind === "EXACT" && meaning.exact_time && parseHm(meaning.exact_time)) {
    return { normalized: null, localTimeHm: meaning.exact_time.trim() };
  }

  if (meaning.time_kind === "DAYPART" && meaning.daypart) {
    return { normalized: null, daypartOnly: meaning.daypart };
  }

  if (hasTimeSignal && meaning.time_expression?.trim()) {
    const normalized = normalizeSchedulingMeaning(meaning, clock, policy);
    if (normalized.precision !== "UNRESOLVED") {
      return { normalized };
    }
  }

  return null;
}

export function appointmentWhenHasSignal(
  constraint: AppointmentWhenConstraint | null | undefined,
): boolean {
  if (!constraint) return false;
  return Boolean(
    constraint.localTimeHm ||
      constraint.daypartOnly ||
      constraint.normalized?.localDate ||
      constraint.normalized?.precision === "EXACT_TIME" ||
      constraint.normalized?.precision === "DAYPART" ||
      constraint.normalized?.precision === "RANGE" ||
      constraint.normalized?.precision === "OPEN_RANGE",
  );
}
