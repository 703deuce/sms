/**
 * Microsoft Graph dateTimeTimeZone boundary — IANA internally, Windows TZ at adapter only.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/datetimetimezone
 * @see https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
 */
import {
  formatInstantAsGraphLocalWallDateTime,
  resolveMicrosoftGraphTimeZoneId,
  toMicrosoftDateTimeTimeZone,
} from "./microsoft-graph-datetime-timezone";
import { wallTimeInZoneToUtc } from "../../time/timezone";
import type { NormalizedSchedulingPreference } from "../../time/scheduling-types";

export type MicrosoftGraphDateTimeTimeZone = {
  dateTime: string;
  timeZone: string;
};

/** Parse Voice V3 local ISO with offset into UTC Date. */
export function parseVoiceV3LocalIsoToDate(localIso: string, ianaTimeZone: string): Date | null {
  const trimmed = localIso.trim();
  const withOffset = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/.exec(trimmed);
  if (withOffset) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const wall = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (wall) {
    return wallTimeInZoneToUtc(
      ianaTimeZone,
      Number(wall[1]),
      Number(wall[2]),
      Number(wall[3]),
      Number(wall[4]),
      Number(wall[5]),
    );
  }
  return null;
}

export function toMicrosoftDateTimeTimeZoneFromLocalIso(
  localDateTime: string,
  ianaTimeZone: string,
): MicrosoftGraphDateTimeTimeZone {
  const instant =
    parseVoiceV3LocalIsoToDate(localDateTime, ianaTimeZone) ??
    new Date(localDateTime);
  return toMicrosoftDateTimeTimeZone(instant, ianaTimeZone);
}

export function toMicrosoftGraphScheduleWindow(
  normalized: NormalizedSchedulingPreference,
): { startTime: MicrosoftGraphDateTimeTimeZone; endTime: MicrosoftGraphDateTimeTimeZone } | null {
  const tz = normalized.timezone;
  if (!normalized.localStartDateTime || !normalized.localEndDateTime) {
    if (normalized.localDate && normalized.precision === "DATE_ONLY") {
      const startWall = `${normalized.localDate}T00:00:00`;
      const endWall = `${normalized.localDate}T23:59:00`;
      return {
        startTime: {
          dateTime: startWall,
          timeZone: resolveMicrosoftGraphTimeZoneId(tz),
        },
        endTime: {
          dateTime: endWall,
          timeZone: resolveMicrosoftGraphTimeZoneId(tz),
        },
      };
    }
    return null;
  }

  const startInstant = parseVoiceV3LocalIsoToDate(normalized.localStartDateTime, tz);
  const endInstant = parseVoiceV3LocalIsoToDate(normalized.localEndDateTime, tz);
  if (!startInstant || !endInstant) return null;

  return {
    startTime: toMicrosoftDateTimeTimeZone(startInstant, tz),
    endTime: toMicrosoftDateTimeTimeZone(endInstant, tz),
  };
}

export { formatInstantAsGraphLocalWallDateTime, resolveMicrosoftGraphTimeZoneId };
