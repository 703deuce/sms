import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

/**
 * Map scheduling specialist structured output → a slot id from the session offer list only.
 * Customer utterance is never parsed here — only LLM JSON fields (id / 1-based index).
 */
export function resolveOfferedSlotIdFromSpecialist(
  specialist: SchedulingSpecialistResult,
  offeredSlots: MctbBookingSlot[],
  _timeZone: string,
): string | null {
  if (!offeredSlots.length) return null;

  if (specialist.offered_slot_id) {
    const id = specialist.offered_slot_id.trim();
    if (offeredSlots.some((s) => s.slotId === id)) return id;
    return null;
  }

  const idx = specialist.offered_slot_index;
  if (idx != null && Number.isFinite(idx) && idx >= 1 && idx <= offeredSlots.length) {
    return offeredSlots[idx - 1]?.slotId ?? null;
  }

  return null;
}
