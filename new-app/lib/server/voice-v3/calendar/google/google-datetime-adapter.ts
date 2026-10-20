/**
 * Google Calendar dateTime + timeZone boundary.
 * Canonical Transovo instants (UTC) + IANA business timezone → Google wire format.
 * Do NOT pass Microsoft Graph shapes or raw UTC `...Z` strings as dateTime when timeZone is IANA.
 */
import { zonedDateParts, wallTimeInZoneToUtc } from "../../time/timezone";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export type GoogleCalendarDateTimeField = {
  dateTime: string;
  timeZone: string;
};

/** Wall-clock civil time in IANA zone (no manual UTC offset). */
export function formatInstantAsGoogleLocalWallDateTime(date: Date, ianaTimeZone: string): string {
  const p = zonedDateParts(date, ianaTimeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

export function toGoogleCalendarDateTimeField(
  instant: Date,
  ianaTimeZone: string,
): GoogleCalendarDateTimeField {
  const tz = ianaTimeZone.trim() || "UTC";
  if (tz === "UTC" || tz === "Etc/UTC") {
    return {
      dateTime: instant.toISOString().replace(/\.\d{3}Z$/, "Z"),
      timeZone: "UTC",
    };
  }
  return {
    dateTime: formatInstantAsGoogleLocalWallDateTime(instant, tz),
    timeZone: tz,
  };
}

export function canonicalUtcIntervalToGoogleTimedEventBounds(input: {
  startUtc: string;
  endUtc: string;
  timeZone: string;
}): { start: GoogleCalendarDateTimeField; end: GoogleCalendarDateTimeField } | null {
  const start = new Date(input.startUtc);
  const end = new Date(input.endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  const tz = input.timeZone.trim() || "UTC";
  return {
    start: toGoogleCalendarDateTimeField(start, tz),
    end: toGoogleCalendarDateTimeField(end, tz),
  };
}

export type GoogleEventDateTimeWire = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

/**
 * Parse Google start/end into a UTC instant. Handles timed (dateTime) and all-day (date, end exclusive).
 */
export function googleWireToUtcInstant(
  wire: GoogleEventDateTimeWire,
  fallbackIanaTimeZone: string,
): Date | null {
  if (wire.dateTime) {
    const raw = wire.dateTime.trim();
    if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const wall = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(raw);
    if (wall) {
      const tz = (wire.timeZone || fallbackIanaTimeZone).trim() || "UTC";
      return wallTimeInZoneToUtc(
        tz,
        Number(wall[1]),
        Number(wall[2]),
        Number(wall[3]),
        Number(wall[4]),
        Number(wall[5]),
        Number(wall[6]),
      );
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (wire.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wire.date.trim());
    if (!m) return null;
    const tz = (wire.timeZone || fallbackIanaTimeZone).trim() || "UTC";
    return wallTimeInZoneToUtc(tz, Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0);
  }
  return null;
}

/** All-day busy interval in UTC (end.date is exclusive per Google). */
export function googleAllDayWireToUtcInterval(
  start: GoogleEventDateTimeWire,
  end: GoogleEventDateTimeWire,
  fallbackIanaTimeZone: string,
): { startUtc: string; endUtc: string } | null {
  if (!start.date || !end.date) return null;
  const startInstant = googleWireToUtcInstant({ date: start.date, timeZone: start.timeZone }, fallbackIanaTimeZone);
  const endInstant = googleWireToUtcInstant({ date: end.date, timeZone: end.timeZone }, fallbackIanaTimeZone);
  if (!startInstant || !endInstant) return null;
  return {
    startUtc: startInstant.toISOString(),
    endUtc: endInstant.toISOString(),
  };
}

export function isGoogleAllDayEventWire(
  start: GoogleEventDateTimeWire,
  end: GoogleEventDateTimeWire,
): boolean {
  return Boolean(start.date && !start.dateTime && end.date && !end.dateTime);
}
