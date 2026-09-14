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

export {
  resolveCustomerChoiceAmongOfferedSlots,
  buildCustomerOfferSms,
  buildOfferSelectionClarification,
  formatMctbBookingSlotLabel,
} from "@/lib/mctb/ai-booking/offered-slot-selection";

/** @deprecated use resolveCustomerChoiceAmongOfferedSlots */
export { resolveCustomerChoiceAmongOfferedSlots as resolveOfferedSlotChoice } from "@/lib/mctb/ai-booking/offered-slot-selection";

