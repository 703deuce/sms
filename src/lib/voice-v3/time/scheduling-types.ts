export type SchedulingDateRelation =
  | "TODAY"
  | "TOMORROW"
  | "DAY_AFTER_TOMORROW"
  | "THIS_WEEKDAY"
  | "NEXT_WEEKDAY"
  | "EXPLICIT_DATE"
  | "EARLIEST_AVAILABLE"
  | "UNSPECIFIED";

export type SchedulingWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type SchedulingTimeKind =
  | "EXACT"
  | "AFTER"
  | "BEFORE"
  | "BETWEEN"
  | "DAYPART"
  | "ANYTIME"
  | "UNSPECIFIED";

export type SchedulingDaypart = "MORNING" | "AFTERNOON" | "EVENING";

export type SchedulingPrecision =
  | "DATE_ONLY"
  | "DAYPART"
  | "EXACT_TIME"
  | "RANGE"
  | "OPEN_RANGE"
  | "UNRESOLVED";

/** Semantic scheduling from Astra (Structured Output). */
export interface SchedulingMeaning {
  date_expression: string | null;
  date_relation: SchedulingDateRelation;
  weekday: SchedulingWeekday | null;
  explicit_date: string | null;
  time_expression: string | null;
  time_kind: SchedulingTimeKind;
  exact_time: string | null;
  start_time: string | null;
  end_time: string | null;
  daypart: SchedulingDaypart | null;
}

export interface SchedulingPolicy {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
  evening: { start: string; end: string };
}

export const DEFAULT_SCHEDULING_POLICY: SchedulingPolicy = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "21:00" },
};

export interface NormalizedSchedulingPreference {
  timezone: string;
  localDate: string | null;
  localStartDateTime: string | null;
  localEndDateTime: string | null;
  utcStart: string | null;
  utcEnd: string | null;
  sourceDateExpression: string | null;
  sourceTimeExpression: string | null;
  precision: SchedulingPrecision;
}

export function emptySchedulingMeaning(): SchedulingMeaning {
  return {
    date_expression: null,
    date_relation: "UNSPECIFIED",
    weekday: null,
    explicit_date: null,
    time_expression: null,
    time_kind: "UNSPECIFIED",
    exact_time: null,
    start_time: null,
    end_time: null,
    daypart: null,
  };
}

export function normalizedSchedulingEquals(
  a: NormalizedSchedulingPreference | null | undefined,
  b: NormalizedSchedulingPreference | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.timezone === b.timezone &&
    a.localDate === b.localDate &&
    a.localStartDateTime === b.localStartDateTime &&
    a.localEndDateTime === b.localEndDateTime &&
    a.utcStart === b.utcStart &&
    a.utcEnd === b.utcEnd &&
    a.precision === b.precision
  );
}
