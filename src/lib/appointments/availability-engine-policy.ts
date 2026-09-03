/**
 * Pure availability policy — weekly hours, overrides, timezone helpers (testable).
 */
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

export type WeeklyHours = Record<string, Array<{ open: string; close: string }>>;

export type AvailabilitySlot = { startsAt: string; endsAt: string };

export type DateOverride = {
  date: string;
  closed?: boolean;
  windows?: Array<{ open: string; close: string }>;
};

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function defaultWeeklyHours(): WeeklyHours {
  return {
    monday: [{ open: "09:00", close: "17:00" }],
    tuesday: [{ open: "09:00", close: "17:00" }],
    wednesday: [{ open: "09:00", close: "17:00" }],
    thursday: [{ open: "09:00", close: "17:00" }],
    friday: [{ open: "09:00", close: "17:00" }],
    saturday: [],
    sunday: [],
  };
}

export function parseHm(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function dayKeyInTimezone(iso: string, timezone: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
    .format(new Date(iso))
    .toLowerCase();
  return weekday;
}

export function dateKeyInTimezone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function minutesInTimezone(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function resolveWeeklyHours(platform: AppointmentPlatformConfig): WeeklyHours {
  return platform.weeklyHours && Object.keys(platform.weeklyHours).length
    ? platform.weeklyHours
    : defaultWeeklyHours();
}

export function isWithinWeeklyHours(
  startsAtIso: string,
  timezone: string,
  weeklyHours: WeeklyHours,
  dateOverrides: DateOverride[] = [],
): boolean {
  const dateKey = dateKeyInTimezone(startsAtIso, timezone);
  const override = dateOverrides.find((o) => o.date === dateKey);
  if (override?.closed) return false;

  const windows =
    override?.windows ||
    weeklyHours[dayKeyInTimezone(startsAtIso, timezone)] ||
    weeklyHours[dayKeyInTimezone(startsAtIso, timezone).toLowerCase()] ||
    [];

  if (!windows.length) return false;

  const minute = minutesInTimezone(startsAtIso, timezone);
  return windows.some((w) => {
    const open = parseHm(w.open);
    const close = parseHm(w.close);
    if (open == null || close == null) return false;
    return minute >= open && minute < close;
  });
}

export function isBlackoutOrClosed(
  startsAtIso: string,
  platform: AppointmentPlatformConfig,
): boolean {
  const timezone = platform.timezone || "America/New_York";
  const dateKey = dateKeyInTimezone(startsAtIso, timezone);
  const overrides = platform.dateOverrides || [];
  if (overrides.some((o) => o.date === dateKey && o.closed)) return true;
  if (platform.blackoutDates?.includes(dateKey)) return true;
  return !isWithinWeeklyHours(startsAtIso, timezone, resolveWeeklyHours(platform), overrides);
}

export function bookingHoursSummary(weeklyHours: WeeklyHours): string {
  const lines: string[] = [];
  for (const day of DAY_KEYS) {
    const windows = weeklyHours[day] || [];
    if (!windows.length) {
      lines.push(`${day}: closed`);
      continue;
    }
    lines.push(`${day}: ${windows.map((w) => `${w.open}-${w.close}`).join(", ")}`);
  }
  return lines.join("\n");
}

export function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
