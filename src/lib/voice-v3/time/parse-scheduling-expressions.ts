import type {
  SchedulingDateRelation,
  SchedulingDaypart,
  SchedulingMeaning,
  SchedulingTimeKind,
  SchedulingWeekday,
} from "./scheduling-types";
import { emptySchedulingMeaning } from "./scheduling-types";

const WEEKDAYS: Array<{ token: string; enum: SchedulingWeekday }> = [
  { token: "monday", enum: "MONDAY" },
  { token: "tuesday", enum: "TUESDAY" },
  { token: "wednesday", enum: "WEDNESDAY" },
  { token: "thursday", enum: "THURSDAY" },
  { token: "friday", enum: "FRIDAY" },
  { token: "saturday", enum: "SATURDAY" },
  { token: "sunday", enum: "SUNDAY" },
];

function normalizeText(dateExpression?: string | null, timeExpression?: string | null): string {
  return [dateExpression, timeExpression]
    .filter((s) => typeof s === "string" && s.trim())
    .join(" ")
    .trim()
    .toLowerCase();
}

function parseWeekday(text: string): {
  weekday: SchedulingWeekday;
  relation: "THIS_WEEKDAY" | "NEXT_WEEKDAY";
} | null {
  for (const row of WEEKDAYS) {
    if (!text.includes(row.token)) continue;
    if (text.includes(`next ${row.token}`)) {
      return { weekday: row.enum, relation: "NEXT_WEEKDAY" };
    }
    if (text.includes(`this ${row.token}`)) {
      return { weekday: row.enum, relation: "THIS_WEEKDAY" };
    }
    return { weekday: row.enum, relation: "THIS_WEEKDAY" };
  }
  return null;
}

function parseDaypart(text: string): SchedulingDaypart | null {
  if (/\bmorning\b/.test(text)) return "MORNING";
  if (/\bafternoon\b/.test(text)) return "AFTERNOON";
  if (/\bevening\b/.test(text) || /\bafter work\b/.test(text)) return "EVENING";
  return null;
}

function parseExactOrAfterTime(text: string): {
  time_kind: SchedulingTimeKind;
  exact_time: string | null;
  start_time: string | null;
} {
  const after = text.match(/\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (after) {
    let hour = parseInt(after[1], 10);
    const minute = after[2] ? parseInt(after[2], 10) : 0;
    const ampm = after[3]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (!ampm && hour >= 1 && hour <= 7) hour += 12;
    const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { time_kind: "AFTER", exact_time: null, start_time: start };
  }

  const at = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (at) {
    let hour = parseInt(at[1], 10);
    const minute = at[2] ? parseInt(at[2], 10) : 0;
    const ampm = at[3].toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const exact = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { time_kind: "EXACT", exact_time: exact, start_time: null };
  }

  return { time_kind: "UNSPECIFIED", exact_time: null, start_time: null };
}

/**
 * Deterministic bridge from find_availability NL args → SchedulingMeaning for normalizeSchedulingMeaning.
 */
export function parseSchedulingExpressionsToMeaning(input: {
  dateExpression?: string | null;
  timeExpression?: string | null;
}): SchedulingMeaning {
  const base = emptySchedulingMeaning();
  const dateExpr = input.dateExpression?.trim() || null;
  const timeExpr = input.timeExpression?.trim() || null;
  base.date_expression = dateExpr;
  base.time_expression = timeExpr;

  const text = normalizeText(dateExpr, timeExpr);
  if (!text) return base;

  if (/\btoday\b/.test(text)) {
    base.date_relation = "TODAY";
  } else if (/\bday after tomorrow\b/.test(text)) {
    base.date_relation = "DAY_AFTER_TOMORROW";
  } else if (/\btomorrow\b/.test(text)) {
    base.date_relation = "TOMORROW";
  } else {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) {
      base.date_relation = "EXPLICIT_DATE";
      base.explicit_date = iso[1];
    } else {
      const wd = parseWeekday(text);
      if (wd) {
        base.date_relation = wd.relation;
        base.weekday = wd.weekday;
      }
    }
  }

  const daypart = parseDaypart(text);
  if (daypart) {
    base.time_kind = "DAYPART";
    base.daypart = daypart;
  } else {
    const time = parseExactOrAfterTime(text);
    base.time_kind = time.time_kind;
    base.exact_time = time.exact_time;
    base.start_time = time.start_time;
  }

  if (/\banytime\b|\bany time\b/.test(text)) {
    base.time_kind = "ANYTIME";
  }

  return base;
}
