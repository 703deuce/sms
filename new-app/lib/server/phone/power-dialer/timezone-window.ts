/** Wall-clock helpers for campaign calling windows (no external TZ library). */

export function parseHm(hm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

export function localDateParts(now: Date, timeZone: string): { weekday: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: map[wd] ?? 1, minutes: hour * 60 + minute };
}

export function isCallingWindowOpen(
  now: Date,
  timeZone: string,
  allowedDays: number[],
  startHm: string,
  endHm: string,
): { open: boolean; nextOpenAt?: Date } {
  const { weekday, minutes } = localDateParts(now, timeZone);
  if (!allowedDays.includes(weekday)) {
    return { open: false };
  }
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (!start || !end) return { open: true };
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  if (startMin <= endMin) {
    return { open: minutes >= startMin && minutes < endMin };
  }
  return { open: minutes >= startMin || minutes < endMin };
}

export function startOfDayInTimezone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}
