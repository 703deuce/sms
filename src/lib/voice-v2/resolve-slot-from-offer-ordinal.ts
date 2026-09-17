import type { VoiceV2Slot } from "./types";
import { resolveSelectedSlotIdFromOffer } from "./resolve-slot-from-offer";

/** Preserve offer-set order (runtime authoritative ordering). */
function orderedSlots(slots: VoiceV2Slot[]): VoiceV2Slot[] {
  return [...slots];
}

/**
 * Resolve ordinal/reference language against an ordered offer set ("the later one", "first one").
 */
export function resolveSlotIdFromOfferReference(
  slots: VoiceV2Slot[],
  phrase: string,
): string | null {
  const text = phrase.trim().toLowerCase();
  if (!text || slots.length === 0) return null;

  const byTime = orderedSlots(slots);
  if (/\b(later|last)\s+one\b|\bthe\s+latest\b/i.test(text)) {
    return byTime[byTime.length - 1]?.slot_id ?? null;
  }
  if (/\b(earlier|first)\s+one\b|\bthe\s+first\b/i.test(text)) {
    return byTime[0]?.slot_id ?? null;
  }
  if (/\bsecond\s+one\b|\bthe\s+second\b/i.test(text)) {
    return byTime[1]?.slot_id ?? null;
  }
  if (/\bthird\s+one\b|\bthe\s+third\b/i.test(text)) {
    return byTime[2]?.slot_id ?? null;
  }

  if (typeof phrase === "string" && /^\d+$/.test(phrase.trim())) {
    return resolveSelectedSlotIdFromOffer(slots, phrase);
  }

  return resolveSelectedSlotIdFromOffer(slots, phrase);
}
