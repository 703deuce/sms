/**
 * Deterministic date/time resolution for appointment AI.
 * LLM may suggest relative phrases; authoritative timestamps come from here.
 */

export function formatTimestampInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfDayInTimezone(date: Date, timezone: string): Date {
  const key = dateKeyInTimezone(date, timezone);
  return new Date(`${key}T12:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function resolveRelativeDatePhrase(
  phrase: string,
  now: Date,
  timezone: string,
): string | undefined {
  const lower = phrase.toLowerCase().trim();
  const todayKey = dateKeyInTimezone(now, timezone);
  const today = startOfDayInTimezone(now, timezone);

  if (lower.includes("today")) return todayKey;
  if (lower.includes("tomorrow")) {
    return dateKeyInTimezone(addDays(today, 1), timezone);
  }
  if (lower.includes("yesterday")) {
    return dateKeyInTimezone(addDays(today, -1), timezone);
  }

  const nextWeekMatch = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextWeekMatch) {
    const target = DAY_NAMES.indexOf(nextWeekMatch[1] as typeof DAY_NAMES[number]);
    const currentDay = new Date(
      `${todayKey}T12:00:00.000Z`,
    ).getUTCDay();
    let diff = target - currentDay;
    if (diff <= 0) diff += 7;
    diff += 7;
    return dateKeyInTimezone(addDays(today, diff), timezone);
  }

  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (lower.includes(DAY_NAMES[i])) {
      const currentDay = new Date(`${todayKey}T12:00:00.000Z`).getUTCDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      return dateKeyInTimezone(addDays(today, diff), timezone);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;
  return undefined;
}

export function isPastDate(dateKey: string, now: Date, timezone: string): boolean {
  const todayKey = dateKeyInTimezone(now, timezone);
  return dateKey < todayKey;
}

export function resolveTimePeriod(
  period: "morning" | "afternoon" | "evening" | null | undefined,
): { startMinutes?: number; endMinutes?: number } {
  switch (period) {
    case "morning":
      return { startMinutes: 6 * 60, endMinutes: 12 * 60 };
    case "afternoon":
      return { startMinutes: 12 * 60, endMinutes: 17 * 60 };
    case "evening":
      return { startMinutes: 17 * 60, endMinutes: 21 * 60 };
    default:
      return {};
  }
}

export function parseExactTime(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return undefined;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour >= 1 && hour <= 7) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function buildIsoFromDateAndTime(
  dateKey: string,
  timeHHMM: string,
  timezone: string,
): string | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const probe = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(probe);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const offsetMatch = offsetPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!offsetMatch) return probe.toISOString();

  const sign = offsetMatch[1].startsWith("-") ? -1 : 1;
  const oh = Math.abs(parseInt(offsetMatch[1], 10));
  const om = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;
  const offsetMinutes = sign * (oh * 60 + om);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0) - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}
