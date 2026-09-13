import { addCalendarDays, wallTimeInZoneToUtc, zonedDateParts } from "@/lib/voice/calendar/timezone-slots";
import { resolveDaypart } from "@/lib/mctb/ai-booking/dayparts";

export type SchedulingInterpreterIntent =
  | "CHECK_AVAILABILITY"
  | "SELECT_OFFERED_SLOT"
  | "CONFIRM_BOOKING"
  | "NONE";

export type SchedulingInterpretation = {
  intent: SchedulingInterpreterIntent;
  timezone: string;
  windowStartUtc: string | null;
  windowEndUtc: string | null;
  preferredTimeUtc: string | null;
  relativeReference: string | null;
  confidence: number;
  needsClarification: boolean;
  clarificationHint?: string;
  choiceUtterance?: string | null;
  confirmBooking?: boolean;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function startOfLocalDayUtc(now: Date, tz: string): Date {
  const p = zonedDateParts(now, tz);
  return wallTimeInZoneToUtc(tz, p.year, p.month, p.day, 0, 0);
}

function localDayBoundsUtc(
  tz: string,
  year: number,
  month: number,
  day: number,
  startHour = 0,
  endHour = 23,
): { start: Date; end: Date } {
  const start = wallTimeInZoneToUtc(tz, year, month, day, startHour, 0);
  const end = wallTimeInZoneToUtc(tz, year, month, day, endHour, 59);
  return { start, end };
}

function nextWeekday(
  now: Date,
  tz: string,
  target: string,
): { year: number; month: number; day: number } {
  const p = zonedDateParts(now, tz);
  const targetIdx = WEEKDAYS.indexOf(target.slice(0, 3));
  if (targetIdx < 0) return { year: p.year, month: p.month, day: p.day };
  const currentIdx = new Date(
    wallTimeInZoneToUtc(tz, p.year, p.month, p.day, 12, 0),
  ).getUTCDay();
  let delta = (targetIdx - currentIdx + 7) % 7;
  if (delta === 0) delta = 7;
  return addCalendarDays(p.year, p.month, p.day, delta);
}

function parseSpecificTime(
  text: string,
  tz: string,
  anchor: Date,
): { hour: number; minute: number } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour <= 7) hour += 12;
  if (hour > 23 || minute > 59) return null;
  const p = zonedDateParts(anchor, tz);
  const utc = wallTimeInZoneToUtc(tz, p.year, p.month, p.day, hour, minute);
  return { hour, minute };
}

export function interpretSchedulingUtterance(input: {
  text: string;
  timezone: string;
  now?: Date;
  hasActiveBookingSession?: boolean;
}): SchedulingInterpretation {
  const tz = input.timezone || "America/New_York";
  const now = input.now ?? new Date();
  const raw = input.text.trim();
  const text = raw.toLowerCase();

  if (!text) {
    return {
      intent: "NONE",
      timezone: tz,
      windowStartUtc: null,
      windowEndUtc: null,
      preferredTimeUtc: null,
      relativeReference: null,
      confidence: 0,
      needsClarification: false,
    };
  }

  if (input.hasActiveBookingSession) {
    if (/^(yes|yeah|yep|confirm|book it|sounds good)\b/i.test(raw)) {
      return {
        intent: "CONFIRM_BOOKING",
        timezone: tz,
        windowStartUtc: null,
        windowEndUtc: null,
        preferredTimeUtc: null,
        relativeReference: null,
        confidence: 0.9,
        needsClarification: false,
        confirmBooking: true,
        choiceUtterance: raw,
      };
    }
    if (/\d|first|second|third|am|pm|afternoon|morning|works/i.test(text)) {
      return {
        intent: "SELECT_OFFERED_SLOT",
        timezone: tz,
        windowStartUtc: null,
        windowEndUtc: null,
        preferredTimeUtc: null,
        relativeReference: null,
        confidence: 0.85,
        needsClarification: false,
        choiceUtterance: raw,
      };
    }
  }

  const schedulingCue =
    /\b(book|schedule|appointment|available|availability|come out|visit|slot|time|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|weekend)\b/i.test(
      text,
    ) || /\b(do you have|can you|can someone|when can)\b/i.test(text);

  if (!schedulingCue) {
    return {
      intent: "NONE",
      timezone: tz,
      windowStartUtc: null,
      windowEndUtc: null,
      preferredTimeUtc: null,
      relativeReference: null,
      confidence: 0,
      needsClarification: false,
    };
  }

  let ymd = zonedDateParts(now, tz);
  let relativeReference: string | null = null;
  let startHour = 8;
  let endHour = 18;
  let preferredTimeUtc: string | null = null;

  if (/\btomorrow\b/.test(text)) {
    relativeReference = "tomorrow";
    ymd = addCalendarDays(ymd.year, ymd.month, ymd.day, 1);
  } else if (/\btoday\b/.test(text)) {
    relativeReference = "today";
  } else if (/\bnext week\b/.test(text)) {
    relativeReference = "next_week";
    ymd = addCalendarDays(ymd.year, ymd.month, ymd.day, 7);
    startHour = 8;
    endHour = 18;
  } else if (/\bthis weekend\b/.test(text)) {
    relativeReference = "this_weekend";
    const sat = nextWeekday(now, tz, "sat");
    ymd = sat;
    startHour = 9;
    endHour = 16;
  } else {
    for (const wd of WEEKDAYS) {
      const full = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
        WEEKDAYS.indexOf(wd)
      ];
      if (text.includes(full) || text.includes(`next ${full}`)) {
        relativeReference = full;
        ymd = nextWeekday(now, tz, wd);
        break;
      }
    }
  }

  for (const [label, win] of Object.entries({
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    lunch: "lunch",
  })) {
    if (text.includes(label)) {
      const dp = resolveDaypart(win)!;
      startHour = dp.startHour;
      endHour = dp.endHour;
      relativeReference = relativeReference ? `${relativeReference}_${label}` : label;
    }
  }

  const afterMatch = text.match(/\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (afterMatch) {
    let hour = Number(afterMatch[1]);
    const ampm = afterMatch[3]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (!ampm && hour <= 7) hour += 12;
    startHour = hour;
    endHour = 20;
    relativeReference = (relativeReference || "after_time") + `_after_${hour}`;
  }

  const aroundMatch = text.match(/\baround\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const atTomorrow = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+tomorrow\b/i,
  );
  const haveTomorrow = text.match(
    /\b(?:do you have|can you do|available)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+tomorrow\b/i,
  );

  if (haveTomorrow || atTomorrow || aroundMatch || /\bcan you do\b/i.test(text)) {
    const m = haveTomorrow || atTomorrow || aroundMatch;
    if (m) {
      let hour = Number(m[1]);
      const minute = m[2] ? Number(m[2]) : 0;
      const ampm = m[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      if (!ampm && hour <= 7) hour += 12;
      if (/\btomorrow\b/.test(text)) {
        ymd = addCalendarDays(zonedDateParts(now, tz).year, zonedDateParts(now, tz).month, zonedDateParts(now, tz).day, 1);
      }
      const inst = wallTimeInZoneToUtc(tz, ymd.year, ymd.month, ymd.day, hour, minute);
      preferredTimeUtc = inst.toISOString();
      const narrowStart = new Date(inst.getTime() - 45 * 60_000);
      const narrowEnd = new Date(inst.getTime() + 45 * 60_000);
      return {
        intent: "CHECK_AVAILABILITY",
        timezone: tz,
        windowStartUtc: narrowStart.toISOString(),
        windowEndUtc: narrowEnd.toISOString(),
        preferredTimeUtc,
        relativeReference,
        confidence: 0.88,
        needsClarification: false,
      };
    }
  }

  if (/\bfriday\b/.test(text) && !text.match(/morning|afternoon|after|\d/)) {
    return {
      intent: "CHECK_AVAILABILITY",
      timezone: tz,
      windowStartUtc: localDayBoundsUtc(tz, ymd.year, ymd.month, ymd.day, 8, 18).start.toISOString(),
      windowEndUtc: localDayBoundsUtc(tz, ymd.year, ymd.month, ymd.day, 8, 18).end.toISOString(),
      preferredTimeUtc: null,
      relativeReference: relativeReference || "friday",
      confidence: 0.7,
      needsClarification: true,
      clarificationHint: "Would morning or afternoon work better on Friday?",
    };
  }

  const bounds = localDayBoundsUtc(tz, ymd.year, ymd.month, ymd.day, startHour, endHour);
  const windowStart = bounds.start < now ? now : bounds.start;
  const windowEnd =
    bounds.end.getTime() < windowStart.getTime()
      ? new Date(windowStart.getTime() + 4 * 3600_000)
      : bounds.end;

  return {
    intent: "CHECK_AVAILABILITY",
    timezone: tz,
    windowStartUtc: windowStart.toISOString(),
    windowEndUtc: windowEnd.toISOString(),
    preferredTimeUtc,
    relativeReference,
    confidence: 0.8,
    needsClarification: false,
  };
}
