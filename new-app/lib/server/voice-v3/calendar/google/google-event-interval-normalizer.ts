import type { CalendarBusyInterval } from "../types";
import {
  googleAllDayWireToUtcInterval,
  googleWireToUtcInstant,
  isGoogleAllDayEventWire,
  type GoogleEventDateTimeWire,
} from "./google-datetime-adapter";

export type GoogleEventWireShape = {
  start?: GoogleEventDateTimeWire;
  end?: GoogleEventDateTimeWire;
  status?: string;
  transparency?: string;
};

export function googleEventBlocksAvailability(event: GoogleEventWireShape): boolean {
  if (event.status === "cancelled") return false;
  if (event.transparency === "transparent") return false;
  return true;
}

/**
 * Normalize a Google Calendar event into Transovo canonical busy interval (UTC instants).
 */
export function normalizeGoogleEventToBusyInterval(input: {
  event: GoogleEventWireShape;
  calendarId: string;
  fallbackIanaTimeZone: string;
}): CalendarBusyInterval | null {
  const start = input.event.start;
  const end = input.event.end;
  if (!start || !end) return null;
  if (!googleEventBlocksAvailability(input.event)) return null;

  const tz = input.fallbackIanaTimeZone.trim() || "UTC";

  if (isGoogleAllDayEventWire(start, end)) {
    const interval = googleAllDayWireToUtcInterval(start, end, tz);
    if (!interval) return null;
    return {
      calendarId: input.calendarId,
      startUtc: interval.startUtc,
      endUtc: interval.endUtc,
    };
  }

  const startInstant = googleWireToUtcInstant(start, tz);
  const endInstant = googleWireToUtcInstant(end, tz);
  if (!startInstant || !endInstant) return null;

  return {
    calendarId: input.calendarId,
    startUtc: startInstant.toISOString(),
    endUtc: endInstant.toISOString(),
  };
}
