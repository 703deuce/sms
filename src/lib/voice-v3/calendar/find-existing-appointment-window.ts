import type { NormalizedSchedulingPreference } from "../time/scheduling-types";
import { resolveSearchWindowFromNormalized } from "./find-availability";
import { parseYmd, wallTimeInZoneToUtc } from "../time/timezone";

const DEFAULT_LOOKBACK_DAYS = 1;
const DEFAULT_LOOKAHEAD_DAYS = 60;

/** Bounded calendarView window for locating existing appointments. */
export function buildFindExistingAppointmentWindow(input: {
  timezone: string;
  dateHint?: NormalizedSchedulingPreference | null;
  dateExpression?: string | null;
  nowUtc?: Date;
  durationMinutes?: number;
}): { rangeStartUtc: string; rangeEndUtc: string } {
  const durationMinutes = input.durationMinutes ?? 60;
  if (input.dateHint) {
    const fromNormalized = resolveSearchWindowFromNormalized(
      input.dateHint,
      input.timezone,
      durationMinutes,
    );
    if (fromNormalized) {
      const dayMs = 24 * 60 * 60_000;
      return {
        rangeStartUtc: new Date(new Date(fromNormalized.rangeStartUtc).getTime() - dayMs).toISOString(),
        rangeEndUtc: new Date(new Date(fromNormalized.rangeEndUtc).getTime() + dayMs).toISOString(),
      };
    }
  }

  const expr = input.dateExpression?.trim();
  if (expr && /^\d{4}-\d{2}-\d{2}$/.test(expr)) {
    const ymd = parseYmd(expr);
    if (ymd) {
      const start = wallTimeInZoneToUtc(input.timezone, ymd.year, ymd.month, ymd.day, 0, 0);
      const end = wallTimeInZoneToUtc(input.timezone, ymd.year, ymd.month, ymd.day, 23, 59);
      const dayMs = 24 * 60 * 60_000;
      return {
        rangeStartUtc: new Date(start.getTime() - dayMs).toISOString(),
        rangeEndUtc: new Date(end.getTime() + dayMs).toISOString(),
      };
    }
  }

  const now = input.nowUtc ?? new Date();
  const lookbackMs = DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60_000;
  const lookaheadMs = DEFAULT_LOOKAHEAD_DAYS * 24 * 60 * 60_000;
  return {
    rangeStartUtc: new Date(now.getTime() - lookbackMs).toISOString(),
    rangeEndUtc: new Date(now.getTime() + lookaheadMs).toISOString(),
  };
}
