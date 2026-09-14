/** TEST ONLY — removed from production scheduling path. */
import { interpretSchedulingUtterance } from "@/lib/mctb/ai-booking/scheduling-interpreter";
import { resolveOfferedSlotIdFromSpecialist } from "@/lib/mctb/ai-booking/resolve-offered-slot-from-specialist";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";

export function deterministicSchedulingSpecialist(input: {
  message: string;
  timezone: string;
  offeredSlots: MctbBookingSlot[];
  aiBookingSessionActive: boolean;
  now?: Date;
}): SchedulingSpecialistResult {
  const interp = interpretSchedulingUtterance({
    text: input.message,
    timezone: input.timezone,
    hasActiveBookingSession: input.aiBookingSessionActive,
    now: input.now,
  });
  if (interp.intent === "SELECT_OFFERED_SLOT" || interp.intent === "CONFIRM_BOOKING") {
    const specialist: SchedulingSpecialistResult = {
      action: interp.confirmBooking ? "CONFIRM_BOOKING" : "SELECT_OFFERED_SLOT",
      timezone: input.timezone,
      offered_slot_index: interp.offeredSlotIndex ?? null,
      requested_local_date: interp.requestedLocalDate ?? null,
      requested_local_time: interp.requestedLocalTime ?? null,
    };
    const slotId = resolveOfferedSlotIdFromSpecialist(
      specialist,
      input.offeredSlots,
      input.timezone,
    );
    const slot = slotId ? input.offeredSlots.find((s) => s.slotId === slotId) : null;
    return {
      action: interp.confirmBooking ? "CONFIRM_BOOKING" : "SELECT_OFFERED_SLOT",
      offered_slot_id: slot?.slotId ?? null,
      timezone: input.timezone,
      needs_clarification: !slot,
      clarification_text: slot ? null : "Which of the times I offered works best?",
    };
  }
  return {
    action: "CHECK_AVAILABILITY",
    window_start: interp.windowStartUtc,
    window_end: interp.windowEndUtc,
    timezone: interp.timezone,
    needs_clarification: interp.needsClarification,
    clarification_text: interp.clarificationHint,
  };
}
