import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

export type ResolvedOfferedSlot =
  | { ok: true; slotId: string }
  | { ok: false; reason: "AMBIGUOUS_SLOT_SELECTION" | "UNKNOWN_SLOT_ID" };

/**
 * Map scheduling specialist structured output → a slot id from the session offer list only.
 */
export function resolveOfferedSlotIdFromSpecialist(
  specialist: SchedulingSpecialistResult,
  offeredSlots: MctbBookingSlot[],
  _timeZone: string,
): string | null {
  const result = resolveOfferedSlotFromSpecialistDetailed(specialist, offeredSlots);
  return result.ok ? result.slotId : null;
}

export function resolveOfferedSlotFromSpecialistDetailed(
  specialist: SchedulingSpecialistResult,
  offeredSlots: MctbBookingSlot[],
): ResolvedOfferedSlot {
  if (!offeredSlots.length) return { ok: false, reason: "UNKNOWN_SLOT_ID" };

  const idFromIndex =
    specialist.offered_slot_index != null &&
    Number.isFinite(specialist.offered_slot_index) &&
    specialist.offered_slot_index >= 1 &&
    specialist.offered_slot_index <= offeredSlots.length
      ? offeredSlots[specialist.offered_slot_index - 1]?.slotId ?? null
      : null;

  const rawId = specialist.offered_slot_id?.trim() || null;
  const idFromField =
    rawId && offeredSlots.some((s) => s.slotId === rawId) ? rawId : rawId ? null : null;

  if (rawId && !idFromField) {
    return { ok: false, reason: "UNKNOWN_SLOT_ID" };
  }

  if (idFromField && idFromIndex && idFromField !== idFromIndex) {
    return { ok: false, reason: "AMBIGUOUS_SLOT_SELECTION" };
  }

  const slotId = idFromField || idFromIndex;
  if (!slotId) return { ok: false, reason: "UNKNOWN_SLOT_ID" };
  return { ok: true, slotId };
}
