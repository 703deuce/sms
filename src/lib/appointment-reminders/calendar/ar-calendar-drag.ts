import { snapDecimalHour } from "@/features/appointments/kimi/calendar/calendar-drag-math";
import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";
import type { ArCalendarGrid } from "@/lib/appointment-reminders/calendar/ar-calendar-layout";

export function decimalHourFromPointerY(
  columnTop: number,
  clientY: number,
  grid: ArCalendarGrid,
): number {
  const y = clientY - columnTop;
  const raw = grid.startHour + y / grid.hourPx;
  const max = grid.endHour;
  return snapDecimalHour(Math.max(grid.startHour, Math.min(max, raw)));
}

export function isoFromDayKeyAndDecimalHour(
  dayKey: string,
  decimalHour: number,
  timeZone: string,
): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  return wallTimeInZoneToUtc(timeZone, y, mo, d, h, m).toISOString();
}

export function dayIndexFromWeekPointer(
  gridLeft: number,
  gridWidth: number,
  clientX: number,
  timeColWidth = 60,
  dayCount = 7,
): number {
  const innerWidth = gridWidth - timeColWidth;
  const x = clientX - gridLeft - timeColWidth;
  const idx = Math.floor((x / innerWidth) * dayCount);
  return Math.max(0, Math.min(dayCount - 1, idx));
}
