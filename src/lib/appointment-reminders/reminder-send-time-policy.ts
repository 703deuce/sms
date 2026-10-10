import type { AppointmentPlatformConfig, DateOverride, ReminderStepConfig } from "@/lib/appointments/types";
import {
  dayKeyInTimezone,
  isWithinWeeklyHours,
  minutesInTimezone,
  parseHm,
  type WeeklyHours,
} from "@/lib/appointments/availability-engine-policy";

function isWeekendInTimezone(fireAt: Date, timezone: string): boolean {
  const day = dayKeyInTimezone(fireAt.toISOString(), timezone || "America/New_York");
  return day === "saturday" || day === "sunday";
}

function isOutsideQuietHours(
  fireAt: Date,
  timezone: string,
  quiet: NonNullable<AppointmentPlatformConfig["reminderQuietHours"]>,
): boolean {
  if (!quiet.enabled || !quiet.start || !quiet.end) return false;
  const start = parseHm(quiet.start);
  const end = parseHm(quiet.end);
  if (start == null || end == null) return false;
  const minute = minutesInTimezone(fireAt.toISOString(), timezone || "America/New_York");
  if (start <= end) {
    return minute < start || minute >= end;
  }
  // Overnight quiet window (e.g. 22:00–08:00): allow sends only between end and start.
  return minute >= start || minute < end;
}

/**
 * When true, discovery skips enqueue for this tick (send-time guard).
 * Uses workspace timezone, weekly hours, date overrides, and optional reminderQuietHours.
 */
export function shouldSkipReminderSendNow(input: {
  step: ReminderStepConfig;
  fireAt: Date;
  weeklyHours: WeeklyHours;
  timezone: string;
  dateOverrides?: DateOverride[];
  reminderQuietHours?: AppointmentPlatformConfig["reminderQuietHours"];
}): boolean {
  const tz = input.timezone || "America/New_York";
  const iso = input.fireAt.toISOString();
  const { step, weeklyHours, dateOverrides, reminderQuietHours } = input;

  if (step.skipWeekends && isWeekendInTimezone(input.fireAt, tz)) {
    return true;
  }

  if (step.skipClosedDays && !isWithinWeeklyHours(iso, tz, weeklyHours, dateOverrides || [])) {
    return true;
  }

  if (step.skipOffHours) {
    if (reminderQuietHours?.enabled) {
      if (isOutsideQuietHours(input.fireAt, tz, reminderQuietHours)) return true;
    } else if (!isWithinWeeklyHours(iso, tz, weeklyHours, dateOverrides || [])) {
      return true;
    }
  }

  return false;
}

/** @deprecated Use shouldSkipReminderSendNow — kept for existing imports. */
export function shouldSkipStepNow(
  step: ReminderStepConfig,
  fireAt: Date,
  weeklyHours: WeeklyHours,
  timezone: string,
  reminderQuietHours?: AppointmentPlatformConfig["reminderQuietHours"],
  dateOverrides?: DateOverride[],
): boolean {
  return shouldSkipReminderSendNow({
    step,
    fireAt,
    weeklyHours,
    timezone,
    dateOverrides,
    reminderQuietHours,
  });
}
