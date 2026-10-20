import { zonedDateParts } from "../time/timezone";

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

/** ISO-like local timestamp with offset for display and date-hint matching. */
export function formatLocalIsoForZone(at: Date, timezone: string): string {
  const p = zonedDateParts(at, timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = formatOffset(timezone, at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${offset}`;
}
