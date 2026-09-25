import "server-only";

import { getPrisma } from "@/lib/db";
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "@/lib/voice/calendar/timezone-slots";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics-range";

const DEFAULT_TZ = "America/New_York";

export async function loadWorkspaceTimeZone(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId },
    select: { timezone: true },
  });
  const tz = messaging?.timezone?.trim();
  return tz || DEFAULT_TZ;
}

/** Calendar YYYY-MM-DD in workspace IANA timezone. */
export function workspaceCalendarDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfWorkspaceDayUtc(now: Date, timeZone: string): Date {
  const p = zonedDateParts(now, timeZone);
  return wallTimeInZoneToUtc(timeZone, p.year, p.month, p.day, 0, 0);
}

export function analyticsRangeBounds(
  range: MctbAnalyticsRange,
  timeZone: string,
  now = new Date(),
): { since: Date; dayKeys: string[]; timeZone: string } {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const todayKey = workspaceCalendarDateKey(now, timeZone);
  const [y, m, d] = todayKey.split("-").map((n) => Number(n));
  const first = addCalendarDays(y, m, d, -(days - 1));
  const since = startOfWorkspaceDayUtc(
    new Date(Date.UTC(first.year, first.month - 1, first.day, 12, 0, 0)),
    timeZone,
  );
  const dayKeys: string[] = [];
  let cy = first.year;
  let cm = first.month;
  let cd = first.day;
  for (let i = 0; i < days; i++) {
    const key = `${String(cy).padStart(4, "0")}-${String(cm).padStart(2, "0")}-${String(cd).padStart(2, "0")}`;
    dayKeys.push(key);
    const next = addCalendarDays(cy, cm, cd, 1);
    cy = next.year;
    cm = next.month;
    cd = next.day;
  }
  return { since, dayKeys, timeZone };
}
