import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

const SLOT_MATCH_TOLERANCE_MS = 90_000;

/** Keep only slots whose start falls within [windowStartUtc, windowEndUtc] (inclusive). */
export function filterSlotsWithinWindow(
  slots: MctbBookingSlot[],
  windowStartUtc: string,
  windowEndUtc: string,
): MctbBookingSlot[] {
  const start = new Date(windowStartUtc).getTime();
  const end = new Date(windowEndUtc).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return [...slots];
  return slots.filter((s) => {
    const t = new Date(s.startUtc).getTime();
    return t >= start && t <= end;
  });
}

/** Next `count` openings from the provider list (chronological — what we show is what we book). */
export function pickSlotsToOffer(slots: MctbBookingSlot[], count = 3): MctbBookingSlot[] {
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );
  return sorted.slice(0, count);
}

export function findSlotAtTime(
  slots: MctbBookingSlot[],
  targetUtc: string,
): MctbBookingSlot | null {
  const t = new Date(targetUtc).getTime();
  if (Number.isNaN(t)) return null;
  for (const s of slots) {
    const start = new Date(s.startUtc).getTime();
    if (Math.abs(start - t) <= SLOT_MATCH_TOLERANCE_MS) return s;
  }
  return null;
}

/** Closest slots by start time — all must be from `slots` (provider-returned). */
export function nearestSlotAlternatives(
  slots: MctbBookingSlot[],
  targetUtc: string,
  count = 3,
): MctbBookingSlot[] {
  const t = new Date(targetUtc).getTime();
  if (Number.isNaN(t)) return pickSlotsToOffer(slots, count);
  return [...slots]
    .sort(
      (a, b) =>
        Math.abs(new Date(a.startUtc).getTime() - t) -
        Math.abs(new Date(b.startUtc).getTime() - t),
    )
    .slice(0, count);
}

/**
 * Strict syntactic selection only: single digit index or canonical slot id.
 * Natural language ("second one", "afternoon") must come from scheduling LLM → offered_slot_id.
 */
export function resolveStrictNumericOfferedSlot(
  offered: MctbBookingSlot[],
  utterance: string,
): MctbBookingSlot | null {
  const text = utterance.trim();
  if (!text || !offered.length) return null;

  const digit = text.match(/^\s*([1-9])\s*$/);
  if (digit) {
    const idx = Number(digit[1]) - 1;
    if (idx >= 0 && idx < offered.length) return offered[idx];
  }

  for (const slot of offered) {
    if (text === slot.slotId) return slot;
  }
  return null;
}

/** @deprecated use resolveStrictNumericOfferedSlot + LLM offered_slot_id */
export function resolveOfferedSlotChoice(
  offered: MctbBookingSlot[],
  utterance: string,
): MctbBookingSlot | null {
  return resolveStrictNumericOfferedSlot(offered, utterance);
}

export function formatMctbBookingSlotLabel(slot: MctbBookingSlot): string {
  const d = new Date(slot.startUtc);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: slot.timezone,
  });
}

const ORDINAL_INDEX: Record<string, number> = {
  first: 0,
  "1st": 0,
  one: 0,
  second: 1,
  "2nd": 1,
  two: 1,
  third: 2,
  "3rd": 2,
  three: 2,
};

function slotLocalClock(slot: MctbBookingSlot): {
  weekdayShort: string;
  hour12: number;
  minute: number;
  dayPeriod: string;
} {
  const d = new Date(slot.startUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: slot.timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const dayPeriod = get("dayPeriod").toLowerCase();
  return {
    weekdayShort: get("weekday").toLowerCase().slice(0, 3),
    hour12: hour,
    minute,
    dayPeriod,
  };
}

function utteranceMentionsWeekday(text: string): string | null {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  for (const d of days) {
    if (text.includes(d) || text.includes(`${d}day`)) return d;
  }
  return null;
}

function slotMatchesNaturalLanguage(slot: MctbBookingSlot, utterance: string): boolean {
  const text = utterance.toLowerCase();
  const clock = slotLocalClock(slot);
  const mentionedDay = utteranceMentionsWeekday(text);
  if (mentionedDay && !clock.weekdayShort.startsWith(mentionedDay)) {
    return false;
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!timeMatch) return false;
  let hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const ampm = timeMatch[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const period = hour >= 12 ? "pm" : "am";
  if (clock.hour12 !== hour12 && clock.hour12 !== hour) return false;
  if (minute !== 0 && clock.minute !== minute) return false;
  if (ampm && clock.dayPeriod && ampm !== clock.dayPeriod) return false;
  if (!ampm && clock.minute === 0 && clock.hour12 === hour12) return true;
  return clock.hour12 === hour12 && clock.minute === minute;
}

/**
 * Customer may only book one of the offered slots (SMS list). No hidden slots.
 */
export function resolveCustomerChoiceAmongOfferedSlots(
  offered: MctbBookingSlot[],
  utterance: string,
): MctbBookingSlot | null {
  if (!offered.length) return null;

  const strict = resolveStrictNumericOfferedSlot(offered, utterance);
  if (strict) return strict;

  const digitInText = utterance.match(/\b([1-3])\b/);
  if (digitInText) {
    const idx = Number(digitInText[1]) - 1;
    if (idx >= 0 && idx < offered.length) return offered[idx];
  }

  const lower = utterance.toLowerCase();
  for (const [word, idx] of Object.entries(ORDINAL_INDEX)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower) && idx < offered.length) {
      return offered[idx];
    }
  }

  const matches = offered.filter((s) => slotMatchesNaturalLanguage(s, utterance));
  if (matches.length === 1) return matches[0];
  return null;
}

export function buildNumberedOfferSms(slots: MctbBookingSlot[]): string {
  const lines = slots.map((s, i) => `${i + 1}) ${formatMctbBookingSlotLabel(s)}`);
  if (lines.length === 1) {
    return `We have: ${lines[0]}. Reply 1 to book it.`;
  }
  return `We have: ${lines.join(", ")}. Reply 1, 2, or 3 with the number you want.`;
}
