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

/** Pick up to `count` slots to offer — spread across the window when possible. */
export function pickSlotsToOffer(slots: MctbBookingSlot[], count = 3): MctbBookingSlot[] {
  if (slots.length <= count) return [...slots];
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );
  const picks: MctbBookingSlot[] = [];
  const step = Math.max(1, Math.floor(sorted.length / count));
  for (let i = 0; i < sorted.length && picks.length < count; i += step) {
    picks.push(sorted[i]);
  }
  if (picks.length < count) {
    for (const s of sorted) {
      if (!picks.some((p) => p.slotId === s.slotId)) picks.push(s);
      if (picks.length >= count) break;
    }
  }
  return picks.slice(0, count);
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
