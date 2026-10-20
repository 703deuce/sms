import { formatZonedIsoDateTime, formatYmd, zonedDateParts } from "./timezone";

export interface VoiceV3CallClock {
  timezone: string;
  nowUtc: string;
  /** Local ISO-8601 with offset, e.g. 2026-09-17T22:15:00-04:00 */
  nowLocalDateTime: string;
  /** Human-readable local time for prompts */
  nowLocal: string;
  localDate: string;
  localWeekday: string;
}

function formatHumanLocal(timezone: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(at);
  } catch {
    return at.toISOString();
  }
}

/** Authoritative call clock — never ask the model what day it is. */
export function buildVoiceV3CallClock(timezone: string, at: Date = new Date()): VoiceV3CallClock {
  const nowUtc = at.toISOString();
  const p = zonedDateParts(at, timezone);
  const localDate = formatYmd(p.year, p.month, p.day);
  const nowLocalDateTime = formatZonedIsoDateTime(
    timezone,
    p.year,
    p.month,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );

  return {
    timezone,
    nowUtc,
    nowLocalDateTime,
    nowLocal: formatHumanLocal(timezone, at),
    localDate,
    localWeekday: p.weekdayLong,
  };
}
