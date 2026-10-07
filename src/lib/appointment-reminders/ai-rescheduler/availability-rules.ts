import type { AvailableSlot } from "@/lib/appointments/ai-scheduling/availability-bridge";
import type { AiReschedulerConfig, AiReschedulerDayConfig } from "./types";

function weekdayKeyInTimezone(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
    .format(at)
    .toLowerCase();
}

function minutesInTimezone(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hour * 60 + minute;
}

function parseHmLocal(hm: string): number | null {
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function slotPassesArWeeklyHours(
  startsAt: string,
  endsAt: string,
  timezone: string,
  weeklyHours: Record<string, AiReschedulerDayConfig>,
): boolean {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const key = weekdayKeyInTimezone(start, timezone);
  const day = weeklyHours[key];
  if (!day?.enabled) return false;
  const open = parseHmLocal(day.open);
  const close = parseHmLocal(day.close);
  if (open === null || close === null) return false;
  const startM = minutesInTimezone(start, timezone);
  const endM = minutesInTimezone(end, timezone);
  return startM >= open && endM <= close;
}

export function applyArRescheduleRules(
  slots: AvailableSlot[],
  input: {
    timezone: string;
    ar: AiReschedulerConfig;
    now: Date;
  },
): AvailableSlot[] {
  const minStart = input.now.getTime() + input.ar.minimumNoticeMinutes * 60_000;
  const maxStart =
    input.now.getTime() + input.ar.maximumDaysAhead * 24 * 60 * 60 * 1000;
  return slots.filter((s) => {
    const t = new Date(s.startsAt).getTime();
    if (t < minStart || t > maxStart) return false;
    if (!slotPassesArWeeklyHours(s.startsAt, s.endsAt, input.timezone, input.ar.weeklyHours)) {
      return false;
    }
    return true;
  });
}
