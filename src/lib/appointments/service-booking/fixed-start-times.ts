import type { FixedStartTimesConfig } from "./types";
import type { AvailabilitySlot } from "@/lib/appointments/availability-engine-policy";

function hmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function slotStartMinutesInTz(startsAt: string, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(startsAt));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    const d = new Date(startsAt);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function weekdayKeyInTz(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
      .format(new Date(startsAt))
      .toLowerCase();
  } catch {
    return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
      new Date(startsAt).getUTCDay()
    ];
  }
}

export function resolveAllowedStartMinutes(
  config: FixedStartTimesConfig | undefined,
  startsAt: string,
  timezone: string,
): Set<number> | null {
  if (!config?.enabled || !config.times?.length) return null;
  const dayKey = weekdayKeyInTz(startsAt, timezone);
  const dayTimes = config.perWeekday?.[dayKey] ?? config.times;
  const mins = new Set<number>();
  for (const t of dayTimes) {
    const m = hmToMinutes(t);
    if (m != null) mins.add(m);
  }
  return mins.size ? mins : null;
}

/** Filter generated slots to fixed start times when configured. */
export function filterSlotsToFixedStartTimes(
  slots: AvailabilitySlot[],
  config: FixedStartTimesConfig | undefined,
  timezone: string,
): AvailabilitySlot[] {
  if (!config?.enabled) return slots;
  return slots.filter((slot) => {
    const allowed = resolveAllowedStartMinutes(config, slot.startsAt, timezone);
    if (!allowed) return true;
    const startMin = slotStartMinutesInTz(slot.startsAt, timezone);
    if (startMin == null) return false;
    return allowed.has(startMin);
  });
}

export function slotStepMinutes(
  durationMinutes: number,
  customStartIntervalMinutes?: number,
): number {
  if (customStartIntervalMinutes && customStartIntervalMinutes > 0) {
    return customStartIntervalMinutes;
  }
  return durationMinutes;
}
