import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

const SLOT_MATCH_TOLERANCE_MS = 90_000;

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

/** Resolve customer choice against last-offered slots only (stateful). */
export function resolveOfferedSlotChoice(
  offered: MctbBookingSlot[],
  utterance: string,
): MctbBookingSlot | null {
  const text = utterance.trim().toLowerCase();
  if (!text || !offered.length) return null;

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const ampm = timeMatch[3];
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    for (const slot of offered) {
      const d = new Date(slot.startUtc);
      if (d.getUTCHours() === hour && d.getUTCMinutes() === minute) return slot;
      const localH = d.getHours();
      const localM = d.getMinutes();
      if (localH === hour && localM === minute) return slot;
    }
  }

  if (/\b(first|1st|earliest)\b/.test(text)) return offered[0];
  if (/\b(last|latest|third|3rd)\b/.test(text) && offered.length >= 3) return offered[2];
  if (/\b(second|2nd|middle)\b/.test(text) && offered.length >= 2) return offered[1];
  if (/\bafternoon\b/.test(text)) {
    const afternoon = offered.filter((s) => {
      const h = new Date(s.startUtc).getHours();
      return h >= 12 && h < 17;
    });
    if (afternoon.length === 1) return afternoon[0];
  }

  for (const slot of offered) {
    if (text.includes(slot.slotId)) return slot;
  }
  return null;
}
