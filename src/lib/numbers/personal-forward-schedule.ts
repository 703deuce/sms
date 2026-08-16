/**
 * Personal forward schedule evaluation — simple time-of-day windows per weekday.
 */

import type { IncomingCallHandling } from "./personal-call-settings";

export type PersonalScheduleBlock = {
  id: string;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** Local time HH:MM (24h) */
  startTime: string;
  endTime: string;
  handling: IncomingCallHandling;
  targets: string[];
};

export type PersonalForwardSchedule = {
  timezone: string;
  blocks: PersonalScheduleBlock[];
  /** When no block matches */
  outsideHandling: IncomingCallHandling;
  outsideTargets: string[];
};

const DEFAULT_TZ = "America/New_York";

function parseTimeMinutes(value: string): number {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function readPersonalForwardSchedule(
  settings: Record<string, unknown>,
): PersonalForwardSchedule | null {
  const raw = settings.forwardSchedule;
  if (!raw || typeof raw !== "object") return null;
  const schedule = raw as Record<string, unknown>;
  const blocksRaw = schedule.blocks;
  if (!Array.isArray(blocksRaw)) return null;

  const blocks: PersonalScheduleBlock[] = blocksRaw
    .map((b, i) => {
      if (!b || typeof b !== "object") return null;
      const row = b as Record<string, unknown>;
      const days = Array.isArray(row.days)
        ? row.days.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
        : [];
      const targets = Array.isArray(row.targets)
        ? row.targets.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
        : [];
      const handling =
        row.handling === "voicemail_only" || row.handling === "announcement_only"
          ? row.handling
          : "forward";
      return {
        id: typeof row.id === "string" ? row.id : `block-${i}`,
        days,
        startTime: typeof row.startTime === "string" ? row.startTime : "09:00",
        endTime: typeof row.endTime === "string" ? row.endTime : "17:00",
        handling,
        targets,
      };
    })
    .filter(Boolean) as PersonalScheduleBlock[];

  const outsideHandling =
    schedule.outsideHandling === "voicemail_only" ||
    schedule.outsideHandling === "announcement_only"
      ? schedule.outsideHandling
      : "forward";
  const outsideTargets = Array.isArray(schedule.outsideTargets)
    ? schedule.outsideTargets
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
    : [];

  return {
    timezone:
      typeof schedule.timezone === "string" && schedule.timezone.trim()
        ? schedule.timezone.trim()
        : DEFAULT_TZ,
    blocks,
    outsideHandling,
    outsideTargets,
  };
}

export type ScheduleResolution = {
  handling: IncomingCallHandling;
  targets: string[];
  matchedBlockId: string | null;
};

export function resolveForwardSchedule(
  schedule: PersonalForwardSchedule,
  at = new Date(),
): ScheduleResolution {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = dayMap[weekday] ?? at.getDay();
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  const nowMinutes = hour * 60 + minute;

  for (const block of schedule.blocks) {
    if (!block.days.includes(day)) continue;
    const start = parseTimeMinutes(block.startTime);
    const end = parseTimeMinutes(block.endTime);
    const inWindow =
      end > start
        ? nowMinutes >= start && nowMinutes < end
        : nowMinutes >= start || nowMinutes < end;
    if (inWindow) {
      return {
        handling: block.handling,
        targets: block.targets,
        matchedBlockId: block.id,
      };
    }
  }

  return {
    handling: schedule.outsideHandling,
    targets: schedule.outsideTargets,
    matchedBlockId: null,
  };
}
