/**
 * Microsoft Graph dateTimeTimeZone serialization (create/update events).
 * Internal canonical zones are IANA; Graph event create prefers Windows timezone IDs.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/datetimetimezone
 */
import { zonedDateParts } from "@/lib/voice/calendar/timezone-slots";

/** IANA → Windows timezone names supported for Outlook/Exchange event create. */
const IANA_TO_MICROSOFT_GRAPH_TIMEZONE: Record<string, string> = {
  "America/Los_Angeles": "Pacific Standard Time",
  "America/Vancouver": "Pacific Standard Time",
  "America/Tijuana": "Pacific Standard Time",
  "America/Denver": "Mountain Standard Time",
  "America/Phoenix": "US Mountain Standard Time",
  "America/Chicago": "Central Standard Time",
  "America/Mexico_City": "Central Standard Time",
  "America/New_York": "Eastern Standard Time",
  "America/Toronto": "Eastern Standard Time",
  "America/Detroit": "Eastern Standard Time",
  "America/Anchorage": "Alaskan Standard Time",
  "Pacific/Honolulu": "Hawaiian Standard Time",
  UTC: "UTC",
  "Etc/UTC": "UTC",
  GMT: "GMT Standard Time",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isUtcTimeZoneId(timeZone: string): boolean {
  const u = timeZone.trim().toUpperCase();
  return u === "UTC" || u === "ETC/UTC" || u === "GMT";
}

/**
 * Map canonical IANA (or already-Windows) timezone to a Graph-friendly timeZone string.
 */
export function resolveMicrosoftGraphTimeZoneId(ianaOrWindows: string): string {
  const t = ianaOrWindows.trim();
  if (!t) return "UTC";
  const mapped = IANA_TO_MICROSOFT_GRAPH_TIMEZONE[t];
  if (mapped) return mapped;
  // Already a Windows display name (contains space), e.g. "Pacific Standard Time"
  if (t.includes(" ")) return t;
  return t;
}

/**
 * Format an instant as local wall-clock dateTime (no offset suffix) in the given IANA zone.
 */
export function formatInstantAsGraphLocalWallDateTime(date: Date, ianaTimeZone: string): string {
  const p = zonedDateParts(date, ianaTimeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:00`;
}

/**
 * Graph dateTimeTimeZone for event create/update.
 * - UTC: UTC wall clock from the instant (legacy getSchedule paths).
 * - IANA: local civil wall time + Windows timezone id for Graph.
 */
export function toMicrosoftDateTimeTimeZone(
  date: Date,
  timeZone = "UTC",
): { dateTime: string; timeZone: string } {
  const tz = timeZone.trim() || "UTC";
  if (isUtcTimeZoneId(tz)) {
    const dateTime = date.toISOString().replace(/\.\d{3}Z$/, "");
    return { dateTime, timeZone: "UTC" };
  }
  const dateTime = formatInstantAsGraphLocalWallDateTime(date, tz);
  const graphTimeZone = resolveMicrosoftGraphTimeZoneId(tz);
  return { dateTime, timeZone: graphTimeZone };
}
