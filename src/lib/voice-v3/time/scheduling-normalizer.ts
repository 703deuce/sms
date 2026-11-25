import type { VoiceV3CallClock } from "./call-clock";
import {
  addCalendarDaysYmd,
  formatYmd,
  formatZonedIsoDateTime,
  isoWeekdayFromLocalWeekday,
  isoWeekdayFromSchedulingWeekday,
  parseHm,
  parseYmd,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "./timezone";
import { DEFAULT_SCHEDULING_LOOKAHEAD_DAYS } from "../calendar/find-existing-appointment-window";
import type {
  NormalizedSchedulingPreference,
  SchedulingMeaning,
  SchedulingPolicy,
  SchedulingWeekday,
} from "./scheduling-types";
import { DEFAULT_SCHEDULING_POLICY } from "./scheduling-types";

const EARLIEST_AVAILABLE_EXPRESSION_PATTERNS: RegExp[] = [
  /\bearliest\b/,
  /\bsoonest\b/,
  /\bas soon as\b/,
  /\bfirst available\b/,
  /\bnext available\b/,
  /\bwhatever day\b/,
  /\bget me in\b/,
];

function inferEarliestAvailableRelation(meaning: SchedulingMeaning): SchedulingMeaning {
  if (meaning.date_relation !== "UNSPECIFIED") {
    return meaning;
  }
  const expr = (meaning.date_expression ?? "").toLowerCase().trim();
  if (!expr) {
    return meaning;
  }
  if (EARLIEST_AVAILABLE_EXPRESSION_PATTERNS.some((pattern) => pattern.test(expr))) {
    return { ...meaning, date_relation: "EARLIEST_AVAILABLE" };
  }
  return meaning;
}

function normalizeEarliestAvailable(
  meaning: SchedulingMeaning,
  clock: VoiceV3CallClock,
  policy: SchedulingPolicy,
): NormalizedSchedulingPreference {
  const timezone = clock.timezone;
  const base = emptyNormalized(timezone);
  base.sourceDateExpression = meaning.date_expression?.trim() || null;
  base.sourceTimeExpression = meaning.time_expression?.trim() || null;
  base.localDate = clock.localDate;

  const now = new Date(clock.nowUtc);
  const lookaheadMs = DEFAULT_SCHEDULING_LOOKAHEAD_DAYS * 24 * 60 * 60_000;
  base.utcStart = now.toISOString();
  base.utcEnd = new Date(now.getTime() + lookaheadMs).toISOString();

  switch (meaning.time_kind) {
    case "UNSPECIFIED":
    case "ANYTIME":
      base.precision = "OPEN_RANGE";
      return base;

    case "DAYPART": {
      if (!meaning.daypart) {
        base.precision = "OPEN_RANGE";
        return base;
      }
      const window = policyWindow(policy, meaning.daypart);
      const range = buildRange(timezone, clock.localDate, window.start, window.end);
      base.localStartDateTime = range.localStartDateTime;
      base.localEndDateTime = range.localEndDateTime;
      base.precision = "DAYPART";
      return base;
    }

    default:
      base.precision = "OPEN_RANGE";
      return base;
  }
}

function emptyNormalized(timezone: string): NormalizedSchedulingPreference {
  return {
    timezone,
    localDate: null,
    localStartDateTime: null,
    localEndDateTime: null,
    utcStart: null,
    utcEnd: null,
    sourceDateExpression: null,
    sourceTimeExpression: null,
    precision: "UNRESOLVED",
  };
}

function resolveLocalDate(
  meaning: SchedulingMeaning,
  clock: VoiceV3CallClock,
): { localDate: string | null; ambiguous: boolean } {
  const base = parseYmd(clock.localDate);
  if (!base) return { localDate: null, ambiguous: true };

  switch (meaning.date_relation) {
    case "TODAY":
      return { localDate: clock.localDate, ambiguous: false };
    case "TOMORROW": {
      const next = addCalendarDaysYmd(base.year, base.month, base.day, 1);
      return { localDate: formatYmd(next.year, next.month, next.day), ambiguous: false };
    }
    case "DAY_AFTER_TOMORROW": {
      const next = addCalendarDaysYmd(base.year, base.month, base.day, 2);
      return { localDate: formatYmd(next.year, next.month, next.day), ambiguous: false };
    }
    case "EXPLICIT_DATE": {
      if (meaning.explicit_date && parseYmd(meaning.explicit_date)) {
        return { localDate: meaning.explicit_date.trim(), ambiguous: false };
      }
      return { localDate: null, ambiguous: true };
    }
    case "THIS_WEEKDAY":
    case "NEXT_WEEKDAY": {
      if (!meaning.weekday) return { localDate: null, ambiguous: true };
      return resolveWeekdayDate(meaning.weekday, meaning.date_relation, clock);
    }
    case "UNSPECIFIED":
      if (meaning.explicit_date && parseYmd(meaning.explicit_date)) {
        return { localDate: meaning.explicit_date.trim(), ambiguous: false };
      }
      return { localDate: null, ambiguous: false };
    case "EARLIEST_AVAILABLE":
      return { localDate: null, ambiguous: false };
    default:
      return { localDate: null, ambiguous: false };
  }
}

function resolveWeekdayDate(
  weekday: SchedulingWeekday,
  relation: "THIS_WEEKDAY" | "NEXT_WEEKDAY",
  clock: VoiceV3CallClock,
): { localDate: string | null; ambiguous: boolean } {
  const base = parseYmd(clock.localDate);
  if (!base) return { localDate: null, ambiguous: true };

  const currentIso = isoWeekdayFromLocalWeekday(clock.localWeekday);
  const targetIso = isoWeekdayFromSchedulingWeekday(weekday);
  if (!currentIso || !targetIso) return { localDate: null, ambiguous: true };

  let delta = (targetIso - currentIso + 7) % 7;

  if (relation === "THIS_WEEKDAY") {
    if (delta === 0) {
      return { localDate: null, ambiguous: true };
    }
  } else {
    if (delta === 0) {
      delta = 7;
    } else {
      delta += 7;
    }
  }

  const resolved = addCalendarDaysYmd(base.year, base.month, base.day, delta);
  return {
    localDate: formatYmd(resolved.year, resolved.month, resolved.day),
    ambiguous: false,
  };
}

function policyWindow(
  policy: SchedulingPolicy,
  daypart: NonNullable<SchedulingMeaning["daypart"]>,
): { start: string; end: string } {
  return policy[daypart.toLowerCase() as "morning" | "afternoon" | "evening"];
}

function buildRange(
  timezone: string,
  localDate: string,
  startHm: string,
  endHm: string,
): Pick<
  NormalizedSchedulingPreference,
  "localStartDateTime" | "localEndDateTime" | "utcStart" | "utcEnd"
> {
  const ymd = parseYmd(localDate);
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (!ymd || !start || !end) {
    return {
      localStartDateTime: null,
      localEndDateTime: null,
      utcStart: null,
      utcEnd: null,
    };
  }

  const localStart = formatZonedIsoDateTime(
    timezone,
    ymd.year,
    ymd.month,
    ymd.day,
    start.hour,
    start.minute,
  );
  const localEnd = formatZonedIsoDateTime(
    timezone,
    ymd.year,
    ymd.month,
    ymd.day,
    end.hour,
    end.minute,
  );
  const utcStart = wallTimeInZoneToUtc(
    timezone,
    ymd.year,
    ymd.month,
    ymd.day,
    start.hour,
    start.minute,
  ).toISOString();
  const utcEnd = wallTimeInZoneToUtc(
    timezone,
    ymd.year,
    ymd.month,
    ymd.day,
    end.hour,
    end.minute,
  ).toISOString();

  return { localStartDateTime: localStart, localEndDateTime: localEnd, utcStart, utcEnd };
}

function buildExact(
  timezone: string,
  localDate: string,
  hm: string,
): Pick<
  NormalizedSchedulingPreference,
  "localStartDateTime" | "localEndDateTime" | "utcStart" | "utcEnd"
> {
  const range = buildRange(timezone, localDate, hm, hm);
  return range;
}

/**
 * Deterministic calendar normalization — application-owned, not model-owned.
 */
export function normalizeSchedulingMeaning(
  meaning: SchedulingMeaning,
  clock: VoiceV3CallClock,
  policy: SchedulingPolicy = DEFAULT_SCHEDULING_POLICY,
): NormalizedSchedulingPreference {
  const resolvedMeaning = inferEarliestAvailableRelation(meaning);

  if (resolvedMeaning.date_relation === "EARLIEST_AVAILABLE") {
    return normalizeEarliestAvailable(resolvedMeaning, clock, policy);
  }

  const timezone = clock.timezone;
  const base = emptyNormalized(timezone);
  base.sourceDateExpression = resolvedMeaning.date_expression?.trim() || null;
  base.sourceTimeExpression = resolvedMeaning.time_expression?.trim() || null;

  const hasDateSignal =
    resolvedMeaning.date_relation !== "UNSPECIFIED" ||
    Boolean(resolvedMeaning.explicit_date?.trim()) ||
    Boolean(resolvedMeaning.weekday);

  const hasTimeSignal = resolvedMeaning.time_kind !== "UNSPECIFIED";

  if (!hasDateSignal && !hasTimeSignal) {
    return base;
  }

  const { localDate, ambiguous: dateAmbiguous } = resolveLocalDate(resolvedMeaning, clock);
  if (dateAmbiguous || !localDate) {
    if (hasDateSignal) {
      base.precision = "UNRESOLVED";
    }
    return base;
  }

  base.localDate = localDate;

  switch (resolvedMeaning.time_kind) {
    case "UNSPECIFIED":
    case "ANYTIME":
      base.precision = "DATE_ONLY";
      return base;

    case "DAYPART": {
      if (!resolvedMeaning.daypart) {
        base.precision = "UNRESOLVED";
        return base;
      }
      const window = policyWindow(policy, resolvedMeaning.daypart);
      const range = buildRange(timezone, localDate, window.start, window.end);
      Object.assign(base, range);
      base.precision = "DAYPART";
      return base;
    }

    case "EXACT": {
      if (!resolvedMeaning.exact_time || !parseHm(resolvedMeaning.exact_time)) {
        base.precision = "UNRESOLVED";
        return base;
      }
      const exact = buildExact(timezone, localDate, resolvedMeaning.exact_time);
      Object.assign(base, exact);
      base.precision = "EXACT_TIME";
      return base;
    }

    case "AFTER": {
      if (!resolvedMeaning.start_time || !parseHm(resolvedMeaning.start_time)) {
        base.precision = "UNRESOLVED";
        return base;
      }
      const start = buildExact(timezone, localDate, resolvedMeaning.start_time);
      base.localStartDateTime = start.localStartDateTime;
      base.utcStart = start.utcStart;
      base.precision = "OPEN_RANGE";
      return base;
    }

    case "BEFORE": {
      if (!resolvedMeaning.end_time || !parseHm(resolvedMeaning.end_time)) {
        base.precision = "UNRESOLVED";
        return base;
      }
      const end = buildExact(timezone, localDate, resolvedMeaning.end_time);
      base.localEndDateTime = end.localStartDateTime;
      base.utcEnd = end.utcStart;
      base.precision = "OPEN_RANGE";
      return base;
    }

    case "BETWEEN": {
      if (
        !resolvedMeaning.start_time ||
        !resolvedMeaning.end_time ||
        !parseHm(resolvedMeaning.start_time) ||
        !parseHm(resolvedMeaning.end_time)
      ) {
        base.precision = "UNRESOLVED";
        return base;
      }
      const range = buildRange(timezone, localDate, resolvedMeaning.start_time, resolvedMeaning.end_time);
      Object.assign(base, range);
      base.precision = "RANGE";
      return base;
    }

    default:
      base.precision = "UNRESOLVED";
      return base;
  }
}

/** For tests: build clock fields from frozen instant. */
export function buildFrozenClockFields(
  timezone: string,
  at: Date,
): { localDate: string; localWeekday: string; nowLocalDateTime: string; nowUtc: string } {
  const p = zonedDateParts(at, timezone);
  const localDate = formatYmd(p.year, p.month, p.day);
  const nowLocalDateTime = formatZonedIsoDateTime(
    timezone,
    p.year,
    p.month,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return {
    localDate,
    localWeekday: p.weekdayLong,
    nowLocalDateTime,
    nowUtc: at.toISOString(),
  };
}

export function schedulingMeaningHasSignal(meaning: SchedulingMeaning): boolean {
  const withEarliest = inferEarliestAvailableRelation(meaning);
  return (
    withEarliest.date_relation !== "UNSPECIFIED" ||
    Boolean(withEarliest.date_expression?.trim()) ||
    Boolean(withEarliest.explicit_date?.trim()) ||
    Boolean(withEarliest.weekday) ||
    withEarliest.time_kind !== "UNSPECIFIED" ||
    Boolean(withEarliest.time_expression?.trim()) ||
    Boolean(withEarliest.daypart)
  );
}
