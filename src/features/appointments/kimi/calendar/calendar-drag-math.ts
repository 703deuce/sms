const GRID_START = 8;
const HOUR_H = 56;
const SNAP_MINUTES = 15;

export function snapDecimalHour(hour: number) {
  const minutes = hour * 60;
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped / 60;
}

export function decimalHourFromPointer(
  gridTop: number,
  clientY: number,
  scrollTop: number,
): number {
  const y = clientY - gridTop + scrollTop - 57;
  const raw = GRID_START + y / HOUR_H;
  return snapDecimalHour(Math.max(GRID_START, Math.min(GRID_START + 11, raw)));
}

export function isoFromDayAndHour(weekStart: Date, dayIndex: number, decimalHour: number) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function dayIndexFromPointer(
  gridLeft: number,
  gridWidth: number,
  clientX: number,
  timeColWidth = 48,
): number {
  const innerWidth = gridWidth - timeColWidth;
  const x = clientX - gridLeft - timeColWidth;
  const idx = Math.floor((x / innerWidth) * 7);
  return Math.max(0, Math.min(6, idx));
}

export function isReschedulableCalendarEventId(id: string) {
  if (id.startsWith("class:") || id.startsWith("video:") || id.startsWith("meeting:")) {
    return false;
  }
  if (id.startsWith("block:") || id.startsWith("external:")) return false;
  return true;
}
