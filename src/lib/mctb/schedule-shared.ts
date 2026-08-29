/**
 * MCTB schedule types + pure helpers (safe for client components).
 * Server persistence lives in schedule.ts (server-only).
 */
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";

export type MctbScheduleMode = "always_on" | "business_hours" | "after_hours" | "custom";

export type MctbWeeklyDay = {
  day: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type MctbWeeklySchedule = {
  timezone: string;
  days: MctbWeeklyDay[];
};

export type MctbPauseKind = "manual" | "timed" | null;

export type MctbScheduleSettings = {
  scheduleMode: MctbScheduleMode;
  weeklySchedule: MctbWeeklySchedule | null;
  pauseUntil: string | null;
  /** Sticky manual pause — survives accidental enabled=true writes until explicit resume. */
  manuallyPaused: boolean;
};

export function isPauseUntilActive(
  pauseUntil: string | null | undefined,
  now = new Date(),
): boolean {
  if (!pauseUntil?.trim()) return false;
  const until = new Date(pauseUntil);
  return !Number.isNaN(until.getTime()) && until > now;
}

export function resolveMctbPauseKind(
  settings: Pick<MctbScheduleSettings, "pauseUntil" | "manuallyPaused">,
  config: Pick<MissedCallTextConfigRecord, "enabled">,
  now = new Date(),
): MctbPauseKind {
  if (settings.manuallyPaused || !config.enabled) return "manual";
  if (isPauseUntilActive(settings.pauseUntil, now)) return "timed";
  return null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function defaultWeeklySchedule(timezone = "America/New_York"): MctbWeeklySchedule {
  return {
    timezone,
    days: DAY_LABELS.map((_, day) => ({
      day,
      enabled: day >= 1 && day <= 5,
      startTime: "09:00",
      endTime: "17:00",
    })),
  };
}

function parseHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function localParts(now: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const dayIndex = DAY_LABELS.indexOf(weekday);
  return { dayIndex, mins: hour * 60 + minute };
}

function inTimeWindow(mins: number, startHm: string, endHm: string): boolean {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start == null || end == null) return true;
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function isNowInWeeklySchedule(now: Date, weekly: MctbWeeklySchedule): boolean {
  const { dayIndex, mins } = localParts(now, weekly.timezone);
  if (dayIndex < 0) return false;
  const day = weekly.days.find((d) => d.day === dayIndex);
  if (!day?.enabled) return false;
  return inTimeWindow(mins, day.startTime, day.endTime);
}

export function deriveWeeklyFromConfig(config: MissedCallTextConfigRecord): MctbWeeklySchedule {
  const start = config.allowedStartTime || "09:00";
  const end = config.allowedEndTime || "17:00";
  return {
    timezone: config.timezone || "America/New_York",
    days: DAY_LABELS.map((_, day) => ({
      day,
      enabled: true,
      startTime: start,
      endTime: end,
    })),
  };
}

export function readMctbScheduleFromCustomFields(
  customFieldsConfig: unknown,
  config: MissedCallTextConfigRecord,
): MctbScheduleSettings {
  const cfg =
    customFieldsConfig && typeof customFieldsConfig === "object"
      ? (customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  const rawMode = String(mctb.scheduleMode || "");
  let scheduleMode: MctbScheduleMode =
    rawMode === "business_hours" ||
    rawMode === "after_hours" ||
    rawMode === "custom" ||
    rawMode === "always_on"
      ? rawMode
      : config.businessHoursOnly
        ? "business_hours"
        : "always_on";

  let weeklySchedule: MctbWeeklySchedule | null = null;
  const rawWeekly = mctb.weeklySchedule;
  if (rawWeekly && typeof rawWeekly === "object") {
    const w = rawWeekly as Record<string, unknown>;
    const daysRaw = Array.isArray(w.days) ? w.days : [];
    weeklySchedule = {
      timezone: String(w.timezone || config.timezone || "America/New_York"),
      days: daysRaw
        .map((d) => {
          if (!d || typeof d !== "object") return null;
          const row = d as Record<string, unknown>;
          return {
            day: Number(row.day),
            enabled: Boolean(row.enabled),
            startTime: String(row.startTime || "09:00"),
            endTime: String(row.endTime || "17:00"),
          };
        })
        .filter((d): d is MctbWeeklyDay => d != null && d.day >= 0 && d.day <= 6),
    };
  }

  if (!weeklySchedule && scheduleMode === "custom") {
    weeklySchedule = defaultWeeklySchedule(config.timezone);
  }

  const pauseUntil =
    typeof mctb.pauseUntil === "string" && mctb.pauseUntil.trim()
      ? mctb.pauseUntil.trim()
      : null;
  const manuallyPaused = mctb.manuallyPaused === true || (!config.enabled && !pauseUntil);

  return { scheduleMode, weeklySchedule, pauseUntil, manuallyPaused };
}

export function normalizeMctbPauseState(
  settings: MctbScheduleSettings,
  config: Pick<MissedCallTextConfigRecord, "enabled">,
  now = new Date(),
): {
  settings: MctbScheduleSettings;
  config: Pick<MissedCallTextConfigRecord, "enabled">;
  changed: boolean;
} {
  let nextSettings = { ...settings };
  let nextConfig = { ...config };
  let changed = false;

  if (nextSettings.pauseUntil && !isPauseUntilActive(nextSettings.pauseUntil, now)) {
    nextSettings = { ...nextSettings, pauseUntil: null };
    changed = true;
  }

  if (nextSettings.manuallyPaused) {
    if (nextConfig.enabled) {
      nextConfig = { enabled: false };
      changed = true;
    }
    if (nextSettings.pauseUntil) {
      nextSettings = { ...nextSettings, pauseUntil: null };
      changed = true;
    }
  } else if (!nextConfig.enabled) {
    nextSettings = { ...nextSettings, manuallyPaused: true };
    if (nextSettings.pauseUntil) {
      nextSettings = { ...nextSettings, pauseUntil: null };
    }
    changed = true;
  }

  return { settings: nextSettings, config: nextConfig, changed };
}

export function isMctbSchedulePaused(
  settings: MctbScheduleSettings,
  config: Pick<MissedCallTextConfigRecord, "enabled">,
  now = new Date(),
): boolean {
  if (settings.manuallyPaused || !config.enabled) return true;
  return isPauseUntilActive(settings.pauseUntil, now);
}

export function isMctbAutomationActive(
  settings: MctbScheduleSettings,
  config: Pick<MissedCallTextConfigRecord, "enabled">,
  now = new Date(),
): boolean {
  return !isMctbSchedulePaused(settings, config, now);
}

export function isWithinMctbSendWindow(
  now: Date,
  config: MissedCallTextConfigRecord,
  settings: MctbScheduleSettings,
): boolean {
  if (settings.scheduleMode === "always_on") return true;

  const weekly =
    settings.scheduleMode === "custom" && settings.weeklySchedule
      ? settings.weeklySchedule
      : deriveWeeklyFromConfig(config);

  const inWindow = isNowInWeeklySchedule(now, weekly);

  if (settings.scheduleMode === "business_hours" || settings.scheduleMode === "custom") {
    return inWindow;
  }
  if (settings.scheduleMode === "after_hours") {
    return !inWindow;
  }
  return true;
}

export function buildMctbPauseMutation(input: {
  enabled?: boolean;
  pauseUntil?: string | null;
  now?: Date;
}): {
  enabled: boolean;
  pauseUntil: string | null;
  manuallyPaused: boolean;
} | null {
  const now = input.now ?? new Date();

  if (input.enabled === false) {
    return { enabled: false, pauseUntil: null, manuallyPaused: true };
  }

  if (input.enabled === true) {
    return { enabled: true, pauseUntil: null, manuallyPaused: false };
  }

  if (input.pauseUntil !== undefined) {
    if (input.pauseUntil === null) {
      return null;
    }
    if (!isPauseUntilActive(input.pauseUntil, now)) {
      return { enabled: true, pauseUntil: null, manuallyPaused: false };
    }
    return { enabled: true, pauseUntil: input.pauseUntil, manuallyPaused: false };
  }

  return null;
}

export function isMctbSetupPausing(body: {
  enabled?: boolean;
  pauseUntil?: string | null;
}): boolean {
  if (body.enabled === false) return true;
  if (body.pauseUntil) return true;
  return false;
}

export function addPauseUntil(
  duration: "1h" | "4h" | "tomorrow",
  timezone: string,
  now = new Date(),
): string {
  if (duration === "1h") {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  if (duration === "4h") {
    return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return new Date(`${year}-${month}-${day}T08:00:00`).toISOString();
}
