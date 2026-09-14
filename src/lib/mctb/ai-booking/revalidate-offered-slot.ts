import { findAvailableTimes } from "@/lib/mctb/ai-booking/service";
import { findSlotAtTime } from "@/lib/mctb/ai-booking/slot-presentation";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";

/** Provider truth check — selected canonical offered slot still available before create. */
export async function revalidatePersistedOfferedSlot(input: {
  workspaceId: string;
  conversationId: string;
  slot: MctbBookingSlot;
}): Promise<{ ok: true } | { ok: false; reason: "SLOT_NO_LONGER_AVAILABLE" | "PROVIDER_UNAVAILABLE" }> {
  const startMs = Date.parse(input.slot.startUtc);
  const endMs = Date.parse(input.slot.endUtc);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, reason: "SLOT_NO_LONGER_AVAILABLE" };
  }

  const windowStartUtc = new Date(startMs - 15 * 60_000).toISOString();
  const windowEndUtc = new Date(endMs + 15 * 60_000).toISOString();

  const availability = await findAvailableTimes({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    windowStartUtc,
    windowEndUtc,
    timezone: input.slot.timezone,
    maxResults: 32,
  });

  if (!availability.ok) {
    logMctbAiBookingEvent("offered_slot_revalidate_failed", {
      conversationId: input.conversationId,
      semantic_selected_slot_id: input.slot.slotId,
      reason: availability.reason,
    });
    return { ok: false, reason: "PROVIDER_UNAVAILABLE" };
  }

  const byId = availability.slots.find((s) => s.slotId === input.slot.slotId) ?? null;
  const byTime = findSlotAtTime(availability.slots, input.slot.startUtc);
  const stillValid = byId ?? (byTime?.slotId === input.slot.slotId ? byTime : null);

  if (!stillValid) {
    logMctbAiBookingEvent("offered_slot_revalidate_failed", {
      conversationId: input.conversationId,
      semantic_selected_slot_id: input.slot.slotId,
      reason: "SLOT_NO_LONGER_AVAILABLE",
    });
    return { ok: false, reason: "SLOT_NO_LONGER_AVAILABLE" };
  }

  logMctbAiBookingEvent("offered_slot_revalidated", {
    conversationId: input.conversationId,
    runtime_selected_slot_id: input.slot.slotId,
    provider_slot_id: stillValid.slotId,
  });

  return { ok: true };
}
