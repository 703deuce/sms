import type {
  VoiceV2BusinessScheduleConfig,
  VoiceV2DayOfWeek,
  VoiceV2OperatingState,
  VoiceV2ResolvedOperatingState,
  VoiceV2TemporaryClosure,
} from "./types";

const DAY_KEYS: VoiceV2DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function localParts(iso: string, timeZone: string): {
  y: number;
  m: number;
  d: number;
  dow: number;
  minutes: number;
} {
  const dt = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const wd = get("weekday");
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { y, m, d, dow: dowMap[wd] ?? 0, minutes: hour * 60 + minute };
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function inRange(minutes: number, start: string, end: string): boolean {
  const s = parseHm(start);
  const e = parseHm(end);
  if (e <= s) return minutes >= s || minutes < e;
  return minutes >= s && minutes < e;
}

function isOpenFromWeekly(
  schedule: VoiceV2BusinessScheduleConfig,
  local: ReturnType<typeof localParts>,
): boolean {
  const key = DAY_KEYS[local.dow];
  const day = schedule.weekly[key];
  if (!day || day.closed) return false;
  if (!day.ranges.length) return false;
  return day.ranges.some((r) => inRange(local.minutes, r.start, r.end));
}

function matchHoliday(
  schedule: VoiceV2BusinessScheduleConfig,
  local: ReturnType<typeof localParts>,
): { name: string; closedAllDay: boolean; ranges?: { start: string; end: string }[] } | null {
  const today = dateKey(local.y, local.m, local.d);
  for (const h of schedule.holidays) {
    if (today >= h.startDate && today <= h.endDate) {
      return { name: h.name, closedAllDay: h.closedAllDay, ranges: h.ranges };
    }
  }
  return null;
}

function activeTemporaryClosure(
  closure: VoiceV2TemporaryClosure | null | undefined,
  atIso: string,
): VoiceV2TemporaryClosure | null {
  if (!closure?.active) return null;
  const t = Date.parse(atIso);
  const s = Date.parse(closure.startsAt);
  const e = Date.parse(closure.endsAt);
  if (Number.isNaN(t) || Number.isNaN(s) || Number.isNaN(e)) return null;
  if (t >= s && t <= e) return closure;
  return null;
}

export function resolveVoiceV2OperatingState(input: {
  schedule: VoiceV2BusinessScheduleConfig;
  at?: string;
  overflowActive?: boolean;
  liveTemporaryClosure?: VoiceV2TemporaryClosure | null;
}): VoiceV2ResolvedOperatingState {
  const atIso = input.at || new Date().toISOString();
  const tz = input.schedule.timezone || "America/New_York";
  const local = localParts(atIso, tz);

  const liveTemp =
    activeTemporaryClosure(input.liveTemporaryClosure, atIso) ||
    activeTemporaryClosure(input.schedule.temporaryClosure, atIso);

  if (liveTemp) {
    return {
      state: "TEMPORARILY_CLOSED",
      source: "TEMPORARY_CLOSURE",
      reason: liveTemp.reason || "Temporary closure",
      effectiveFrom: liveTemp.startsAt,
      effectiveUntil: liveTemp.endsAt,
      resolvedAt: atIso,
    };
  }

  if (input.overflowActive) {
    return {
      state: "OVERFLOW",
      source: "OVERFLOW_FLAG",
      reason: "Overflow mode",
      resolvedAt: atIso,
    };
  }

  const holiday = matchHoliday(input.schedule, local);
  if (holiday) {
    if (holiday.closedAllDay) {
      return {
        state: "HOLIDAY",
        source: "HOLIDAY_OVERRIDE",
        reason: holiday.name,
        resolvedAt: atIso,
      };
    }
    const open = (holiday.ranges || []).some((r) =>
      inRange(local.minutes, r.start, r.end),
    );
    if (!open) {
      return {
        state: "HOLIDAY",
        source: "HOLIDAY_OVERRIDE",
        reason: holiday.name,
        resolvedAt: atIso,
      };
    }
  }

  const weekend = local.dow === 0 || local.dow === 6;
  const openWeekly = isOpenFromWeekly(input.schedule, local);

  if (openWeekly) {
    return {
      state: "OPEN",
      source: weekend ? "WEEKEND" : "WEEKLY_SCHEDULE",
      resolvedAt: atIso,
    };
  }

  if (weekend) {
    return {
      state: "WEEKEND",
      source: "WEEKEND",
      resolvedAt: atIso,
    };
  }

  return {
    state: "CLOSED_AFTER_HOURS",
    source: "WEEKLY_SCHEDULE",
    resolvedAt: atIso,
  };
}

export function operatingStateLabel(state: VoiceV2OperatingState): string {
  switch (state) {
    case "OPEN":
      return "Open";
    case "CLOSED_AFTER_HOURS":
      return "Closed after hours";
    case "WEEKEND":
      return "Weekend";
    case "HOLIDAY":
      return "Holiday";
    case "TEMPORARILY_CLOSED":
      return "Temporarily closed";
    case "OVERFLOW":
      return "Overflow";
    default:
      return "Unknown";
  }
}
