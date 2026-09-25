import { startOfDayInTimezone } from "../timezone-day-boundary";
import { zonedDateParts } from "../calendar/timezone-slots";

export const VOICE_ANALYTICS_DAY_OPTIONS = [7, 30, 90] as const;
export type VoiceAnalyticsPeriodDays = (typeof VOICE_ANALYTICS_DAY_OPTIONS)[number];

export function normalizeVoiceAnalyticsDays(raw: number): VoiceAnalyticsPeriodDays {
  if (raw === 7 || raw === 30 || raw === 90) return raw;
  return 30;
}

/** Local calendar date key YYYY-MM-DD in IANA timezone. */
export function localDateKeyInTimezone(date: Date, timeZone: string): string {
  const p = zonedDateParts(date, timeZone);
  const y = String(p.year);
  const m = String(p.month).padStart(2, "0");
  const d = String(p.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addCalendarDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** Inclusive local calendar days: today + previous (days-1) days in business timezone. */
export function voiceAnalyticsPeriodBounds(
  days: VoiceAnalyticsPeriodDays,
  timeZone: string,
  now = new Date(),
): { start: Date; end: Date; dayKeys: string[] } {
  const todayStart = startOfDayInTimezone(timeZone, now);
  const todayKey = localDateKeyInTimezone(now, timeZone);
  const startKey = addCalendarDays(todayKey, -(days - 1));
  const start = startOfDayInTimezone(timeZone, new Date(`${startKey}T12:00:00.000Z`));
  const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    dayKeys.push(addCalendarDays(startKey, i));
  }

  return { start, end, dayKeys };
}

export function buildDailyCallVolumeSeries(
  dayKeys: string[],
  countsByDay: Record<string, number>,
): Array<{ date: string; count: number }> {
  return dayKeys.map((date) => ({
    date,
    count: countsByDay[date] ?? 0,
  }));
}
