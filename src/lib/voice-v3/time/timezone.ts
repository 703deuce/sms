import type { SchedulingWeekday } from "./scheduling-types";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    partsFormatters.set(timeZone, fmt);
  }
  return fmt;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function zonedDateParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekdayLong: string;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = partsFormatter(timeZone);
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hour = Number(parts.hour || 0);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekdayLong: String(parts.weekday || ""),
    hour,
    minute: Number(parts.minute || 0),
    second: Number(parts.second || 0),
  };
}

/** Convert wall-clock civil time in IANA zone to UTC instant (DST-safe). */
export function wallTimeInZoneToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const p = zonedDateParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export function addCalendarDaysYmd(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function parseYmd(localDate: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate.trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

const WEEKDAY_TO_ISO: Record<SchedulingWeekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

const LONG_WEEKDAY_TO_ISO: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

export function isoWeekdayFromLocalWeekday(longName: string): number {
  return LONG_WEEKDAY_TO_ISO[longName.trim().toLowerCase()] ?? 0;
}

export function isoWeekdayFromSchedulingWeekday(w: SchedulingWeekday): number {
  return WEEKDAY_TO_ISO[w];
}

/** Offset for instant in IANA zone, e.g. -04:00 */
export function formatOffsetForInstant(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const parts = fmt.formatToParts(date);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tzName);
  if (!m) return "+00:00";
  const sign = m[1];
  const hh = pad2(Number(m[2]));
  const mm = pad2(Number(m[3] ?? "0"));
  return `${sign}${hh}:${mm}`;
}

/** Local ISO-8601 with offset, e.g. 2026-09-17T22:15:00-04:00 */
export function formatZonedIsoDateTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): string {
  const utc = wallTimeInZoneToUtc(timeZone, year, month, day, hour, minute, second);
  const p = zonedDateParts(utc, timeZone);
  const offset = formatOffsetForInstant(utc, timeZone);
  return `${formatYmd(p.year, p.month, p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${offset}`;
}

export function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
