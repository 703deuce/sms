/**
 * Resolve spoken relative dates/times into concrete business-local datetimes.
 * Used by the resolve_datetime voice tool so the model never invents "today"
 * and call-start does not block on a dynvar webhook for the clock.
 */

import {
  buildBusinessLocalClock,
  type BusinessLocalClock,
} from "@/lib/voice/runtime-clock";

export type ResolveDatetimeInput = {
  /** Free-text like "tomorrow at 2pm", "in three hours", "Friday morning". */
  spoken: string;
  timezone: string;
  /** Optional ISO/reference now for tests. */
  now?: Date;
};

export type ResolveDatetimeResult =
  | {
      ok: true;
      clock: BusinessLocalClock;
      spoken: string;
      resolvedLocal: string | null;
      resolvedIso: string | null;
      dayName: string | null;
      confidence: "high" | "medium" | "low";
      note: string;
      speak: string;
    }
  | {
      ok: false;
      error: string;
      clock: BusinessLocalClock;
      speak: string;
    };

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parseHourToken(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/\./g, "");
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3];
  if (!Number.isFinite(hour) || hour > 24 || minute > 59) return null;
  if (meridiem === "a" || meridiem === "am") {
    if (hour === 12) hour = 0;
  } else if (meridiem === "p" || meridiem === "pm") {
    if (hour < 12) hour += 12;
  } else if (hour <= 12 && !m[2]) {
    // Bare 1–7 without am/pm: assume afternoon for typical booking hours.
    if (hour >= 1 && hour <= 7) hour += 12;
  }
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

function extractTimeMinutes(spoken: string): number | null {
  const lower = spoken.toLowerCase();
  if (/\bnoon\b/.test(lower)) return 12 * 60;
  if (/\bmidnight\b/.test(lower)) return 0;
  if (/\bmorning\b/.test(lower) && !/\d/.test(lower)) return 9 * 60;
  if (/\bafternoon\b/.test(lower) && !/\d/.test(lower)) return 14 * 60;
  if (/\bevening\b/.test(lower) && !/\d/.test(lower)) return 17 * 60;

  const patterns = [
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?)\b/i,
    /\b(\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?|am|pm)?)\b/i,
    /\b(\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?|am|pm))\b/i,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (!m) continue;
    const mins = parseHourToken(m[1].replace(/\s+/g, ""));
    if (mins != null) return mins;
  }
  return null;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dayNameForYmd(ymd: string, timeZone: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(anchor);
}

function parseRelativeHours(spoken: string): number | null {
  const lower = spoken.toLowerCase();
  const digit = lower.match(/\bin\s+(\d+(?:\.\d+)?)\s*hours?\b/);
  if (digit) return Number(digit[1]);
  const word = lower.match(
    /\bin\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*hours?\b/,
  );
  if (word) return WORD_NUMBERS[word[1]] ?? null;
  if (/\bin an hour\b/.test(lower)) return 1;
  if (/\bin half an hour\b|\bin 30 minutes\b/.test(lower)) return 0.5;
  return null;
}

function resolveTargetDate(
  spoken: string,
  clock: BusinessLocalClock,
): { ymd: string; confidence: "high" | "medium" | "low"; note: string } | null {
  const lower = spoken.toLowerCase();

  if (/\btoday\b/.test(lower)) {
    return { ymd: clock.current_date, confidence: "high", note: "Resolved as today." };
  }
  if (/\btomorrow\b/.test(lower)) {
    return {
      ymd: addDaysYmd(clock.current_date, 1),
      confidence: "high",
      note: "Resolved as tomorrow.",
    };
  }
  if (/\bday after tomorrow\b/.test(lower)) {
    return {
      ymd: addDaysYmd(clock.current_date, 2),
      confidence: "high",
      note: "Resolved as day after tomorrow.",
    };
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i];
    if (!new RegExp(`\\b${name}\\b`).test(lower)) continue;
    const todayIdx = WEEKDAYS.indexOf(
      clock.current_day.toLowerCase() as (typeof WEEKDAYS)[number],
    );
    if (todayIdx < 0) continue;
    let delta = (i - todayIdx + 7) % 7;
    if (delta === 0 && !/\bthis\b/.test(lower)) {
      // Bare "Friday" when today is Friday → next Friday unless they said "this Friday".
      delta = 7;
    }
    return {
      ymd: addDaysYmd(clock.current_date, delta),
      confidence: "medium",
      note: `Resolved weekday ${name}.`,
    };
  }

  const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return {
      ymd: `${iso[1]}-${iso[2]}-${iso[3]}`,
      confidence: "high",
      note: "Resolved ISO date.",
    };
  }

  return null;
}

function formatLocalLabel(
  ymd: string,
  minuteOfDay: number,
  timeZone: string,
): { local: string; isoApprox: string; dayName: string } {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const dayName = dayNameForYmd(ymd, timeZone);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  const local = `${dayName}, ${ymd} at ${h12}:${String(minutes).padStart(2, "0")} ${ampm} (${timeZone})`;
  const isoApprox = `${ymd}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return { local, isoApprox, dayName };
}

function minuteOfDayFromClock(clock: BusinessLocalClock): number {
  // current_iso_local: YYYY-MM-DDTHH:MM:00±HH:MM
  const m = clock.current_iso_local.match(/T(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Resolve caller speech into a concrete local datetime using business timezone "now".
 */
export function resolveSpokenDatetime(
  input: ResolveDatetimeInput,
): ResolveDatetimeResult {
  const clock = buildBusinessLocalClock(input.timezone, input.now ?? new Date());
  const spoken = (input.spoken || "").trim();
  if (!spoken) {
    return {
      ok: false,
      error: "spoken text is required",
      clock,
      speak: `Right now it is ${clock.current_day}, ${clock.current_date} at ${clock.current_time} ${clock.business_timezone}. Ask what day and time they want.`,
    };
  }

  // Bare "what day is it" / clock check — no appointment phrase.
  if (
    /^(what('s| is)? (today|the (date|day|time))|current (date|time)|business clock)\??$/i.test(
      spoken,
    )
  ) {
    return {
      ok: true,
      clock,
      spoken,
      resolvedLocal: `${clock.current_day}, ${clock.current_date} at ${clock.current_time} (${clock.business_timezone})`,
      resolvedIso: clock.current_iso_local,
      dayName: clock.current_day,
      confidence: "high",
      note: "Returned current business clock.",
      speak: `It is ${clock.current_day}, ${clock.current_date} at ${clock.current_time} ${clock.business_timezone}.`,
    };
  }

  const relativeHours = parseRelativeHours(spoken);
  if (relativeHours != null) {
    const nowMs = (input.now ?? new Date()).getTime();
    const target = new Date(nowMs + relativeHours * 60 * 60 * 1000);
    const targetClock = buildBusinessLocalClock(input.timezone, target);
    const minuteOfDay = minuteOfDayFromClock(targetClock);
    const formatted = formatLocalLabel(
      targetClock.current_date,
      minuteOfDay,
      input.timezone,
    );
    return {
      ok: true,
      clock,
      spoken,
      resolvedLocal: formatted.local,
      resolvedIso: `${formatted.isoApprox}${targetClock.utc_offset}`,
      dayName: formatted.dayName,
      confidence: "high",
      note: `Resolved as ${relativeHours} hour(s) from now.`,
      speak: `That is ${formatted.local}. Confirm this full date and time with the caller before checking availability.`,
    };
  }

  const datePart = resolveTargetDate(spoken, clock);
  const timeMins = extractTimeMinutes(spoken);

  if (!datePart && timeMins == null) {
    return {
      ok: true,
      clock,
      spoken,
      resolvedLocal: null,
      resolvedIso: null,
      dayName: null,
      confidence: "low",
      note:
        "Could not parse a date/time. Ask the caller to clarify. Business clock is included so you know what today is.",
      speak: `I could not parse that time. Right now it is ${clock.current_day}, ${clock.current_date} at ${clock.current_time} ${clock.business_timezone}. Ask them to clarify the day and time.`,
    };
  }

  const ymd = datePart?.ymd ?? clock.current_date;
  const minuteOfDay = timeMins ?? 9 * 60;
  const formatted = formatLocalLabel(ymd, minuteOfDay, input.timezone);
  const confidence =
    datePart && timeMins != null
      ? "high"
      : datePart || timeMins != null
        ? "medium"
        : "low";

  return {
    ok: true,
    clock,
    spoken,
    resolvedLocal: formatted.local,
    resolvedIso: `${formatted.isoApprox}${clock.utc_offset}`,
    dayName: formatted.dayName,
    confidence,
    note:
      datePart?.note ??
      (timeMins != null
        ? "Date defaulted to today because only a time was given."
        : "Parsed partially."),
    speak: `That resolves to ${formatted.local}. Confirm this full date and time with the caller before checking availability.`,
  };
}
