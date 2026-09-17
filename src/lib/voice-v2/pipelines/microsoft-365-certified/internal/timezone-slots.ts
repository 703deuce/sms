/**
 * Constructing an `Intl.DateTimeFormat` costs milliseconds, and a two-week
 * availability scan asks for date parts thousands of times in one request.
 * There are only ever a handful of zones in play, so the formatters are built
 * once and reused.
 */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    partsFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Calendar date parts in a specific IANA timezone. */
export function zonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: string; hour: number; minute: number } {
  const fmt = partsFormatter(timeZone);
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hour = Number(parts.hour || 0);
  // Some engines emit 24:00 for midnight.
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: String(parts.weekday || "").toLowerCase().slice(0, 3),
    hour,
    minute: Number(parts.minute || 0),
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Iteratively corrects for DST offset using Intl.
 */
export function wallTimeInZoneToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const p = zonedDateParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = desired - asUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

/** Add calendar days to a Y-M-D triple (no timezone). */
export function addCalendarDays(
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
