import { parseHm, wallTimeInZoneToUtc, zonedDateParts } from "../time/timezone";
import type { BusinessHoursWindow } from "./types";
import type { CalendarBusyInterval } from "./types";

export interface AvailabilitySlot {
  slotId: string;
  startUtc: string;
  endUtc: string;
  localStart: string;
  localEnd: string;
}

export interface SlotGenerationInput {
  timezone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  durationMinutes: number;
  slotStepMinutes: number;
  businessHours: BusinessHoursWindow;
  busyIntervals: CalendarBusyInterval[];
  /** Busy intervals to ignore (e.g. appointment being rescheduled). */
  freeBusyOverrides?: Array<{ startUtc: string; endUtc: string }>;
  maxSlots?: number;
}

export function filterBusyForReschedule(
  busy: CalendarBusyInterval[],
  existing: { startUtc: string; endUtc: string },
): CalendarBusyInterval[] {
  const eStart = new Date(existing.startUtc).getTime();
  const eEnd = new Date(existing.endUtc).getTime();
  return busy.filter((b) => {
    const bStart = new Date(b.startUtc).getTime();
    const bEnd = new Date(b.endUtc).getTime();
    if (bStart === eStart && bEnd === eEnd) return false;
    if (bStart <= eStart && bEnd >= eEnd) return false;
    return true;
  });
}

function formatLocalIso(timezone: string, at: Date): string {
  const p = zonedDateParts(at, timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = formatOffset(timezone, at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${offset}`;
}

function formatOffset(timezone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (tz === "GMT") return "+00:00";
  const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tz);
  if (!m) return "+00:00";
  const sign = m[1];
  const hh = String(m[2]).padStart(2, "0");
  const mm = m[3] ? String(m[3]).padStart(2, "0") : "00";
  return `${sign}${hh}:${mm}`;
}

function intersectsBusy(
  start: Date,
  end: Date,
  busy: CalendarBusyInterval[],
): boolean {
  return busy.some((b) => {
    const bStart = new Date(b.startUtc);
    const bEnd = new Date(b.endUtc);
    return start < bEnd && end > bStart;
  });
}

function withinBusinessHours(
  start: Date,
  end: Date,
  timezone: string,
  hours: BusinessHoursWindow,
): boolean {
  const p = zonedDateParts(start, timezone);
  const weekdayIndex = weekdayToIndex(p.weekdayLong);
  if (!hours.weekdays.includes(weekdayIndex)) return false;

  const startHm = parseHm(hours.startLocal);
  const endHm = parseHm(hours.endLocal);
  if (!startHm || !endHm) return false;

  const dayStart = wallTimeInZoneToUtc(
    timezone,
    p.year,
    p.month,
    p.day,
    startHm.hour,
    startHm.minute,
  );
  const dayEnd = wallTimeInZoneToUtc(
    timezone,
    p.year,
    p.month,
    p.day,
    endHm.hour,
    endHm.minute,
  );

  return start >= dayStart && end <= dayEnd;
}

function weekdayToIndex(weekday: string): number {
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return map[weekday.slice(0, 3).toLowerCase()] ?? -1;
}

/**
 * Deterministic slot generation: caller window ∩ business hours ∩ free time ∩ duration.
 */
export function generateAvailabilitySlots(input: SlotGenerationInput): AvailabilitySlot[] {
  const maxSlots = input.maxSlots ?? 12;
  const rangeStart = new Date(input.rangeStartUtc);
  const rangeEnd = new Date(input.rangeEndUtc);
  const stepMs = input.slotStepMinutes * 60_000;
  const durationMs = input.durationMinutes * 60_000;

  let busyIntervals = input.busyIntervals;
  if (input.freeBusyOverrides?.length) {
    for (const free of input.freeBusyOverrides) {
      busyIntervals = filterBusyForReschedule(busyIntervals, free);
    }
  }

  const slots: AvailabilitySlot[] = [];
  let cursor = rangeStart.getTime();

  while (cursor + durationMs <= rangeEnd.getTime() && slots.length < maxSlots) {
    const start = new Date(cursor);
    const end = new Date(cursor + durationMs);

    if (
      withinBusinessHours(start, end, input.timezone, input.businessHours) &&
      !intersectsBusy(start, end, busyIntervals)
    ) {
      const slotIndex = slots.length + 1;
      slots.push({
        slotId: `slot_${slotIndex}`,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        localStart: formatLocalIso(input.timezone, start),
        localEnd: formatLocalIso(input.timezone, end),
      });
    }

    cursor += stepMs;
  }

  return slots;
}
