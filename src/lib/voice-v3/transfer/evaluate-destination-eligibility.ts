import type { VoiceV2DayOfWeek } from "@/lib/voice-receptionist-wizard/operating-maturity/types";
import {
  type TransferAvailabilityDayConfig,
  type TransferAvailabilityTimeWindow,
  type TransferDestinationAvailability,
  type TransferDestinationEligibilityResult,
  type TransferEligibilityReason,
  defaultTransferDestinationAvailability,
} from "./destination-availability-types";

const WEEKDAY_ORDER: VoiceV2DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const SHORT_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DOW_TO_KEY: Record<number, VoiceV2DayOfWeek> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function localParts(at: Date, timezone: string): { dow: number; minutes: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const dow = SHORT_TO_DOW[get("weekday")];
    if (dow === undefined) return null;
    const minutes = Number(get("hour")) * 60 + Number(get("minute"));
    if (!Number.isFinite(minutes)) return null;
    return { dow, minutes };
  } catch {
    return null;
  }
}

function windowActive(
  window: TransferAvailabilityTimeWindow,
  dow: number,
  minutes: number,
  anchorDow: number,
): boolean {
  const start = parseHm(window.start);
  const end = parseHm(window.end);
  if (start === null || end === null) return false;

  if (end > start) {
    if (dow !== anchorDow) return false;
    return minutes >= start && minutes < end;
  }

  // Overnight: anchor day from start → next day until end (exclusive).
  const nextDow = (anchorDow + 1) % 7;
  if (dow === anchorDow && minutes >= start) return true;
  if (dow === nextDow && minutes < end) return true;
  return false;
}

function dayConfigActive(
  day: TransferAvailabilityDayConfig,
  anchorKey: VoiceV2DayOfWeek,
  dow: number,
  minutes: number,
): boolean {
  if (!day.enabled) return false;
  if (day.allDay) {
    const anchorDow = WEEKDAY_ORDER.indexOf(anchorKey);
    if (anchorDow < 0) return false;
    return dow === anchorDow;
  }
  const anchorDow = WEEKDAY_ORDER.indexOf(anchorKey);
  if (anchorDow < 0) return false;
  for (const w of day.windows) {
    if (windowActive(w, dow, minutes, anchorDow)) return true;
  }
  return false;
}

export function isValidIanaTimezone(tz: string): boolean {
  const t = tz.trim();
  if (!t) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return true;
  } catch {
    return false;
  }
}

export function normalizeDestinationAvailability(
  raw: TransferDestinationAvailability | null | undefined,
  fallbackTimezone: string,
): TransferDestinationAvailability {
  if (!raw) return defaultTransferDestinationAvailability(fallbackTimezone);
  const timezone =
    raw.timezone?.trim() && isValidIanaTimezone(raw.timezone)
      ? raw.timezone.trim()
      : fallbackTimezone;
  return {
    mode: raw.mode === "SCHEDULED" ? "SCHEDULED" : "ALWAYS",
    timezone,
    temporarilyUnavailable: raw.temporarilyUnavailable === true,
    weekly: raw.weekly ?? {},
  };
}

export function evaluateTransferDestinationEligibility(input: {
  availability: TransferDestinationAvailability | null | undefined;
  enabled: boolean;
  now?: Date;
  businessTimezone: string;
}): TransferDestinationEligibilityResult {
  if (!input.enabled) {
    return { eligible: false, reason: "DISABLED" };
  }

  const availability = normalizeDestinationAvailability(
    input.availability,
    input.businessTimezone,
  );

  if (availability.temporarilyUnavailable) {
    return { eligible: false, reason: "TEMPORARILY_UNAVAILABLE" };
  }

  if (availability.mode === "ALWAYS") {
    return { eligible: true, reason: "ALWAYS_AVAILABLE" };
  }

  const at = input.now ?? new Date();
  const local = localParts(at, availability.timezone);
  if (!local) {
    return { eligible: false, reason: "OUTSIDE_SCHEDULE" };
  }

  for (const key of WEEKDAY_ORDER) {
    const day = availability.weekly[key];
    if (!day) continue;
    if (dayConfigActive(day, key, local.dow, local.minutes)) {
      return { eligible: true, reason: "WITHIN_SCHEDULE" };
    }
  }

  return { eligible: false, reason: "OUTSIDE_SCHEDULE" };
}

/** Map eligibility reason to persisted attempt / skip outcome. */
export function eligibilityToAttemptOutcome(
  reason: TransferEligibilityReason,
): "SKIPPED_OUTSIDE_SCHEDULE" | "SKIPPED_TEMPORARILY_UNAVAILABLE" | "SKIPPED_DISABLED" | null {
  if (reason === "OUTSIDE_SCHEDULE") return "SKIPPED_OUTSIDE_SCHEDULE";
  if (reason === "TEMPORARILY_UNAVAILABLE") return "SKIPPED_TEMPORARILY_UNAVAILABLE";
  if (reason === "DISABLED") return "SKIPPED_DISABLED";
  return null;
}

export function validateScheduledAvailability(
  availability: TransferDestinationAvailability,
): string[] {
  const issues: string[] = [];
  if (!isValidIanaTimezone(availability.timezone)) {
    issues.push("On-call schedule needs a valid timezone.");
  }
  if (availability.mode !== "SCHEDULED") return issues;

  let anyWindow = false;
  for (const key of WEEKDAY_ORDER) {
    const day = availability.weekly[key];
    if (!day?.enabled) continue;
    if (day.allDay) {
      anyWindow = true;
      continue;
    }
    const windows = day.windows ?? [];
    if (!windows.length) {
      issues.push(`${key}: enabled but has no time windows.`);
      continue;
    }
    for (const w of windows) {
      if (parseHm(w.start) === null || parseHm(w.end) === null) {
        issues.push(`${key}: invalid time format (use HH:mm).`);
      }
    }
    anyWindow = anyWindow || windows.length > 0;
    // Overlap check (same-day only)
    const sameDay = windows.filter((w) => {
      const s = parseHm(w.start);
      const e = parseHm(w.end);
      return s !== null && e !== null && e > s;
    });
    for (let i = 0; i < sameDay.length; i++) {
      for (let j = i + 1; j < sameDay.length; j++) {
        const a = sameDay[i];
        const b = sameDay[j];
        const as = parseHm(a.start)!;
        const ae = parseHm(a.end)!;
        const bs = parseHm(b.start)!;
        const be = parseHm(b.end)!;
        if (as < be && bs < ae) {
          issues.push(`${key}: overlapping time windows are not allowed.`);
        }
      }
    }
  }
  if (!anyWindow) {
    issues.push("On-call schedule is selected but no days/windows are configured.");
  }
  return issues;
}

export function formatScheduleWindowLabel(window: TransferAvailabilityTimeWindow): string {
  return `${window.start} → ${window.end}`;
}

export function describeDaySchedule(day: TransferAvailabilityDayConfig | undefined): string {
  if (!day?.enabled) return "Off";
  if (day.allDay) return "All day";
  if (!day.windows?.length) return "No windows";
  return day.windows.map(formatScheduleWindowLabel).join(", ");
}

export { DOW_TO_KEY, WEEKDAY_ORDER as TRANSFER_ELIGIBILITY_WEEKDAY_ORDER };
