/**
 * Business-local clock for call-start dynamic variables.
 * Computed at resolve time — never store these as stale knowledge-base facts.
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type BusinessLocalClock = {
  business_timezone: string;
  current_date: string;
  current_day: string;
  current_time: string;
  utc_offset: string;
  current_iso_local: string;
};

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "shortOffset",
  });
  const map = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return map;
}

/** Normalize "+4" / "GMT-4" / "UTC-04:00" style offsets to ±HH:MM. */
export function normalizeUtcOffset(raw: string | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "+00:00";
  const m = s.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "+00:00";
  const sign = m[1] === "-" ? "-" : "+";
  const hh = String(Number(m[2])).padStart(2, "0");
  const mm = String(Number(m[3] || "0")).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function buildBusinessLocalClock(
  timeZoneInput?: string | null,
  now: Date = new Date(),
): BusinessLocalClock {
  let timeZone = String(timeZoneInput || "").trim() || "America/New_York";
  let map: Record<string, string>;
  try {
    map = partsInZone(now, timeZone);
  } catch {
    timeZone = "America/New_York";
    map = partsInZone(now, timeZone);
  }
  const year = map.year || "1970";
  const month = String(map.month || "01").padStart(2, "0");
  const day = String(map.day || "01").padStart(2, "0");
  const current_date = `${year}-${month}-${day}`;
  const current_day = map.weekday || WEEKDAYS[now.getUTCDay()] || "Wednesday";
  const hour = map.hour || "12";
  const minute = String(map.minute || "00").padStart(2, "0");
  const dayPeriod = map.dayPeriod || "PM";
  const current_time = `${hour}:${minute} ${dayPeriod}`;
  const utc_offset = normalizeUtcOffset(map.timeZoneName);
  return {
    business_timezone: timeZone,
    current_date,
    current_day,
    current_time,
    utc_offset,
    current_iso_local: `${current_date}T${toTwentyFour(hour, dayPeriod).padStart(2, "0")}:${minute}:00${utc_offset}`,
  };
}

function toTwentyFour(hour12: string, dayPeriod: string): string {
  let h = Number(hour12);
  if (!Number.isFinite(h)) return "00";
  const ampm = dayPeriod.toUpperCase();
  if (ampm.startsWith("AM")) {
    if (h === 12) h = 0;
  } else if (ampm.startsWith("PM")) {
    if (h !== 12) h += 12;
  }
  return String(h);
}
