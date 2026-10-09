import type { CalendarConfig } from "@/lib/calendar/providers";

/**
 * Stable UTC calendar-day boundaries for Microsoft calendarView/delta.
 * The moving `now`-based window in defaultSyncWindow() changes endDateTime on every
 * sync tick, which invalidates stored @odata.deltaLink scope and forces bootstrap.
 */
export function resolveMicrosoftCalendarViewSyncWindow(
  config: CalendarConfig,
  now = new Date(),
): { timeMin: Date; timeMax: Date } {
  const lookbackDays = config.syncLookbackDays ?? 7;
  const lookaheadDays = config.syncLookaheadDays ?? 90;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const timeMin = new Date(Date.UTC(y, m, d - lookbackDays, 0, 0, 0, 0));
  const timeMax = new Date(Date.UTC(y, m, d + lookaheadDays, 0, 0, 0, 0));
  return { timeMin, timeMax };
}

/** True when the appointment horizon is close to the stored delta window end — advance deliberately. */
export function shouldAdvanceMicrosoftDeltaWindow(
  storedWindowEndIso: string | undefined,
  now = new Date(),
  advanceWhenWithinDays = 21,
): boolean {
  if (!storedWindowEndIso) return false;
  const end = new Date(storedWindowEndIso);
  if (Number.isNaN(end.getTime())) return false;
  const msUntilEnd = end.getTime() - now.getTime();
  return msUntilEnd < advanceWhenWithinDays * 24 * 60 * 60 * 1000;
}
