import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

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

const WORD_HOUR: Record<string, number> = {
  twelve: 12,
  eleven: 11,
  ten: 10,
  nine: 9,
  eight: 8,
  seven: 7,
  six: 6,
  five: 5,
  four: 4,
  three: 3,
  two: 2,
  one: 1,
};

function slotLocalClock(slot: MctbBookingSlot): {
  weekdayShort: string;
  monthShort: string;
  day: number;
  hour12: number;
  minute: number;
  dayPeriod: string;
} {
  const d = new Date(slot.startUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: slot.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    weekdayShort: get("weekday").toLowerCase().slice(0, 3),
    monthShort: get("month").toLowerCase(),
    day: Number(get("day")),
    hour12: Number(get("hour")),
    minute: Number(get("minute")),
    dayPeriod: get("dayPeriod").toLowerCase(),
  };
}

function utteranceMentionsWeekday(text: string): string | null {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  for (const d of days) {
    if (text.includes(d) || text.includes(`${d}day`)) return d;
  }
  return null;
}

/** Ordinal position in the offered list (0-based), e.g. "the second one works". */
export function resolveOfferedListOrdinalIndex(utterance: string, offerCount: number): number | null {
  if (offerCount < 1) return null;
  const text = utterance.toLowerCase();

  const ordinalRules: Array<{ re: RegExp; index: number }> = [
    { re: /\b(first|1st)\b/, index: 0 },
    { re: /\b(second|2nd)\b/, index: 1 },
    { re: /\b(third|3rd)\b/, index: 2 },
  ];
  for (const { re, index } of ordinalRules) {
    if (re.test(text) && index < offerCount) return index;
  }
  if (offerCount === 3 && /\bmiddle\b/.test(text)) return 1;
  if (/\b(last|latest|later)\b/.test(text)) return offerCount - 1;
  if (/\b(first|earlier|soonest)\b/.test(text)) return 0;

  return null;
}

type ParsedWallTime = { hour12: number; minute: number; dayPeriod: string | null };

function parseWallTimeFromUtterance(utterance: string): ParsedWallTime | null {
  const text = utterance.toLowerCase();

  for (const [word, hour] of Object.entries(WORD_HOUR)) {
    const re = new RegExp(`\\b${word}\\b(?:\\s*(o'?\\s*clock)?)?\\s*(am|pm)?\\b`, "i");
    const m = text.match(re);
    if (m) {
      const dayPeriod = m[2]?.toLowerCase() ?? null;
      return { hour12: hour, minute: 0, dayPeriod };
    }
  }

  const numeric = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (numeric) {
    let hour = Number(numeric[1]);
    const minute = numeric[2] ? Number(numeric[2]) : 0;
    const dayPeriod = numeric[3].toLowerCase();
    if (dayPeriod === "pm" && hour < 12) hour += 12;
    if (dayPeriod === "am" && hour === 12) hour = 0;
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return { hour12, minute, dayPeriod };
  }

  return null;
}

function wallTimeMatchesSlot(slot: MctbBookingSlot, wall: ParsedWallTime, utterance: string): boolean {
  const clock = slotLocalClock(slot);
  const text = utterance.toLowerCase();
  const mentionedDay = utteranceMentionsWeekday(text);
  if (mentionedDay && !clock.weekdayShort.startsWith(mentionedDay)) {
    return false;
  }

  if (clock.hour12 !== wall.hour12) return false;
  if (wall.minute !== 0 && clock.minute !== wall.minute) return false;
  if (wall.dayPeriod && clock.dayPeriod && wall.dayPeriod !== clock.dayPeriod) {
    return false;
  }
  return true;
}

/** Match customer text to one of the slots we actually offered (same labels as SMS). */
export function resolveCustomerChoiceAmongOfferedSlots(
  offered: MctbBookingSlot[],
  utterance: string,
): MctbBookingSlot | null {
  if (!offered.length || !utterance.trim()) return null;

  const ordinal = resolveOfferedListOrdinalIndex(utterance, offered.length);
  if (ordinal != null) return offered[ordinal] ?? null;

  const wall = parseWallTimeFromUtterance(utterance);
  if (wall) {
    const timeMatches = offered.filter((s) => wallTimeMatchesSlot(s, wall, utterance));
    if (timeMatches.length === 1) return timeMatches[0];
    if (timeMatches.length > 1) {
      const mentionedDay = utteranceMentionsWeekday(utterance.toLowerCase());
      if (mentionedDay) {
        const dayFiltered = timeMatches.filter((s) =>
          slotLocalClock(s).weekdayShort.startsWith(mentionedDay),
        );
        if (dayFiltered.length === 1) return dayFiltered[0];
      }
    }
  }

  const normalizedUtterance = utterance.toLowerCase().replace(/\s+/g, " ");
  const labelMatches = offered.filter((s) => {
    const label = formatMctbBookingSlotLabel(s).toLowerCase();
    return normalizedUtterance.includes(label) || label.includes(normalizedUtterance.slice(0, 24));
  });
  if (labelMatches.length === 1) return labelMatches[0];

  return null;
}

export function buildCustomerOfferSms(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatMctbBookingSlotLabel);
  if (labels.length === 1) {
    return `We have an opening at ${labels[0]}. Does that work?`;
  }
  if (labels.length === 2) {
    return `We have openings at ${labels[0]} and ${labels[1]}. Do either work?`;
  }
  return `We have openings at ${labels[0]}, ${labels[1]}, and ${labels[2]}. Do any of those work?`;
}

export function isProviderSlotConflictReason(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    r.includes("conflict") ||
    r.includes("not available") ||
    r.includes("unavailable") ||
    r.includes("busy") ||
    r.includes("double") ||
    r.includes("slot_taken") ||
    r.includes("already booked")
  );
}

export function buildOfferSelectionClarification(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatMctbBookingSlotLabel);
  if (labels.length === 1) {
    return `Just let me know if ${labels[0]} works for you.`;
  }
  return `Which time works best — ${labels.join(", ")}?`;
}
