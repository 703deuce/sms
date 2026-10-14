import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";

/** Default when workspace timezone is missing (US Eastern). */
export const DEFAULT_MCTB_DISPLAY_TIMEZONE = "America/New_York";

export function normalizeMctbDisplayTimeZone(timeZone?: string | null): string {
  const tz = timeZone?.trim();
  if (!tz) return DEFAULT_MCTB_DISPLAY_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_MCTB_DISPLAY_TIMEZONE;
  }
}

function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Customer-facing instant: "April 22nd, 2026 at 3:45 PM" in workspace IANA zone. */
export function formatMctbFriendlyDateTime(
  iso: string | Date | null | undefined,
  timeZone?: string | null,
): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeMctbDisplayTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const month = pick("month");
  const dayNum = Number(pick("day"));
  const year = pick("year");
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPart = Number.isFinite(dayNum) ? ordinalDay(dayNum) : pick("day");
  const yearSuffix = year ? `, ${year}` : "";
  const dayPeriod = pick("dayPeriod");
  const time = dayPeriod ? `${hour}:${minute} ${dayPeriod}` : `${hour}:${minute}`;
  return `${month} ${dayPart}${yearSuffix} at ${time}`;
}

/** Shorter list/table label: "Apr 22, 3:45 PM" in workspace zone. */
export function formatMctbCompactDateTime(
  iso: string | Date | null | undefined,
  timeZone?: string | null,
): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = normalizeMctbDisplayTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Workspace calendar date key (YYYY-MM-DD) → short weekday for charts. */
export function formatMctbChartWeekdayLabel(dateKey: string, timeZone?: string | null): string {
  const [year, month, day] = dateKey.split("-").map((n) => Number(n));
  if (!year || !month || !day) return dateKey;
  const tz = normalizeMctbDisplayTimeZone(timeZone);
  const instant = wallTimeInZoneToUtc(tz, year, month, day, 12, 0);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(instant);
}
