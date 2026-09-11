import type { ClassRecurrence } from "@/lib/appointments/class-series-offering";

export type PlannedOccurrence = { startsAt: string; endsAt: string };

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Sessions are never generated further out than this, however the rule ends. */
const MAX_OCCURRENCES = 60;

export const EMPTY_RECURRENCE: Required<
  Pick<
    ClassRecurrence,
    | "pattern"
    | "startDate"
    | "startTime"
    | "durationMinutes"
    | "repeat"
    | "weekdays"
    | "endsMode"
    | "endsOn"
    | "endsAfter"
  >
> = {
  pattern: "repeating",
  startDate: "",
  startTime: "09:00",
  durationMinutes: 60,
  repeat: "weekly",
  weekdays: [],
  endsMode: "after",
  endsOn: "",
  endsAfter: 8,
};

export function parseClassRecurrence(value: unknown): typeof EMPTY_RECURRENCE {
  const raw = (value && typeof value === "object" ? value : {}) as ClassRecurrence;
  return {
    pattern: raw.pattern === "one_time" ? "one_time" : "repeating",
    startDate: typeof raw.startDate === "string" ? raw.startDate : "",
    startTime: typeof raw.startTime === "string" && raw.startTime ? raw.startTime : "09:00",
    durationMinutes:
      Number.isFinite(raw.durationMinutes) && Number(raw.durationMinutes) > 0
        ? Number(raw.durationMinutes)
        : 60,
    repeat:
      raw.repeat === "daily" || raw.repeat === "biweekly" || raw.repeat === "monthly"
        ? raw.repeat
        : "weekly",
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [],
    endsMode: raw.endsMode === "never" || raw.endsMode === "on" ? raw.endsMode : "after",
    endsOn: typeof raw.endsOn === "string" ? raw.endsOn : "",
    endsAfter:
      Number.isFinite(raw.endsAfter) && Number(raw.endsAfter) > 0 ? Number(raw.endsAfter) : 8,
  };
}

/**
 * Applies a new start date, moving a lone weekday selection to match it.
 *
 * The weekday defaults to the day the class was started on, so picking a
 * Monday start date and leaving Friday ticked would quietly produce Friday
 * sessions. A single selection is treated as the default and follows the date;
 * two or more days are a deliberate choice and are left alone.
 */
export function withStartDate(
  rule: typeof EMPTY_RECURRENCE,
  startDate: string,
): typeof EMPTY_RECURRENCE {
  const next = { ...rule, startDate };
  if (!startDate || rule.weekdays.length !== 1) return next;
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return next;
  const weekday = new Date(y, m - 1, d).getDay();
  return rule.weekdays[0] === weekday ? next : { ...next, weekdays: [weekday] };
}

/**
 * Reads a pattern back off the sessions a class already has.
 *
 * Classes created before the rule was stored, or created by an import, have
 * real sessions and no recurrence. Showing "Not scheduled" for a class that
 * plainly runs every Tuesday is worse than a good guess, and the guess is only
 * ever a starting point: nothing is rewritten until the operator generates
 * sessions.
 */
export function inferClassRecurrence(
  occurrences: Array<{ startsAt: string; endsAt: string }>,
): typeof EMPTY_RECURRENCE | null {
  const sorted = [...occurrences]
    .map((o) => ({ start: new Date(o.startsAt), end: new Date(o.endsAt) }))
    .filter((o) => !Number.isNaN(o.start.getTime()) && !Number.isNaN(o.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (sorted.length === 0) return null;

  const first = sorted[0];
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = {
    ...EMPTY_RECURRENCE,
    startDate: `${first.start.getFullYear()}-${pad(first.start.getMonth() + 1)}-${pad(first.start.getDate())}`,
    startTime: `${pad(first.start.getHours())}:${pad(first.start.getMinutes())}`,
    durationMinutes: Math.max(
      5,
      Math.round((first.end.getTime() - first.start.getTime()) / 60_000),
    ),
    endsMode: "after" as const,
    endsAfter: sorted.length,
  };

  if (sorted.length === 1) {
    return { ...base, pattern: "one_time", endsAfter: 1 };
  }

  const gapDays = Math.round(
    (sorted[1].start.getTime() - first.start.getTime()) / 86_400_000,
  );
  const repeat =
    gapDays <= 1 ? "daily" : gapDays >= 27 ? "monthly" : gapDays >= 12 ? "biweekly" : "weekly";
  const weekdays =
    repeat === "weekly" || repeat === "biweekly"
      ? [...new Set(sorted.map((o) => o.start.getDay()))].sort()
      : [];

  return { ...base, repeat, weekdays };
}

/**
 * Built from the date and time parts rather than `new Date(iso)` so the result
 * is anchored to the browser's zone. The class timezone is recorded separately;
 * converting here would silently shift every session an operator just typed.
 */
function atLocalTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map((n) => Number(n) || 0);
  const next = new Date(date);
  next.setHours(h, m, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Turns a recurrence rule into the concrete sessions it describes. The editor
 * previews the result before it is written, so the same function has to be
 * usable without touching the database.
 */
export function expandClassRecurrence(input: ClassRecurrence): PlannedOccurrence[] {
  const rule = parseClassRecurrence(input);
  if (!rule.startDate) return [];

  const [y, mo, d] = rule.startDate.split("-").map(Number);
  if (!y || !mo || !d) return [];
  const first = new Date(y, mo - 1, d);
  if (Number.isNaN(first.getTime())) return [];

  const duration = Math.max(5, rule.durationMinutes);
  const out: PlannedOccurrence[] = [];
  const push = (day: Date) => {
    const startsAt = atLocalTime(day, rule.startTime);
    out.push({
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
    });
  };

  if (rule.pattern === "one_time") {
    push(first);
    return out;
  }

  const limit =
    rule.endsMode === "after" ? Math.min(rule.endsAfter, MAX_OCCURRENCES) : MAX_OCCURRENCES;
  const until =
    rule.endsMode === "on" && rule.endsOn
      ? (() => {
          const [ey, em, ed] = rule.endsOn.split("-").map(Number);
          const end = new Date(ey, (em || 1) - 1, ed || 1);
          end.setHours(23, 59, 59, 999);
          return end;
        })()
      : null;

  // Weekly and biweekly walk day by day so selected weekdays produce several
  // sessions per week; a rule with no weekday picked falls back to the start
  // day's own weekday rather than generating nothing.
  if (rule.repeat === "weekly" || rule.repeat === "biweekly") {
    const days = rule.weekdays.length > 0 ? [...rule.weekdays].sort() : [first.getDay()];
    const step = rule.repeat === "biweekly" ? 2 : 1;
    const weekStart = addDays(first, -first.getDay());
    for (let week = 0; out.length < limit && week < 260; week += step) {
      for (const weekday of days) {
        const day = addDays(weekStart, week * 7 + weekday);
        if (day < first) continue;
        if (until && day > until) return out;
        if (out.length >= limit) return out;
        push(day);
      }
    }
    return out;
  }

  if (rule.repeat === "daily") {
    for (let i = 0; out.length < limit && i < 365; i += 1) {
      const day = addDays(first, i);
      if (until && day > until) break;
      push(day);
    }
    return out;
  }

  for (let i = 0; out.length < limit && i < 120; i += 1) {
    const day = new Date(first);
    day.setMonth(day.getMonth() + i);
    if (until && day > until) break;
    push(day);
  }
  return out;
}

/** One line describing the rule, for list rows and the summary strip. */
export function describeClassRecurrence(input: ClassRecurrence): string {
  const rule = parseClassRecurrence(input);
  if (!rule.startDate) return "Not scheduled";
  if (rule.pattern === "one_time") {
    return `One-time · ${rule.startDate} at ${rule.startTime}`;
  }
  const days =
    rule.weekdays.length > 0
      ? [...rule.weekdays]
          .sort()
          .map((d) => WEEKDAY_LABELS[d])
          .join(", ")
      : "weekly";
  const cadence =
    rule.repeat === "daily"
      ? "Daily"
      : rule.repeat === "monthly"
        ? "Monthly"
        : rule.repeat === "biweekly"
          ? `Every 2 weeks · ${days}`
          : `Weekly · ${days}`;
  const ends =
    rule.endsMode === "never"
      ? "no end date"
      : rule.endsMode === "on"
        ? `until ${rule.endsOn || "—"}`
        : `${rule.endsAfter} sessions`;
  return `${cadence} at ${rule.startTime} · ${ends}`;
}
