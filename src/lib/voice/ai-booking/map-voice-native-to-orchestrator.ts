import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import { mapSpecialistToOrchestratorInput } from "@/lib/mctb/ai-booking/agents/map-to-orchestrator";
import type { OrchestrateAiBookingInput } from "@/lib/mctb/ai-booking/orchestrator";
import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";

export type VoiceNativeOrchestratorMapResult =
  | { kind: "orchestrate"; input: OrchestrateAiBookingInput }
  | { kind: "cancelled" }
  | { kind: "invalid_offer_set"; message: string }
  | { kind: "invalid_slot"; message: string }
  | { kind: "needs_clarification"; message: string };

function validateOfferSet(
  session: MctbAiBookingSession | null,
  offerSetId: string | null | undefined,
): boolean {
  if (!offerSetId?.trim()) return Boolean(session?.offeredSlots?.length);
  return session?.offerSetId === offerSetId.trim();
}

function validateSelectedSlot(
  offeredSlots: MctbBookingSlot[],
  slotId: string,
): MctbBookingSlot | null {
  return offeredSlots.find((s) => s.slotId === slotId) ?? null;
}

/**
 * Voice-native semantic adapter → canonical orchestrator input.
 * No LLM, no conversational regex — only structural validation.
 */
export function mapVoiceNativeActionToOrchestrator(input: {
  payload: VoiceNativeBookingPayload;
  base: Omit<
    OrchestrateAiBookingInput,
    "windowStartUtc" | "windowEndUtc" | "specificTimeUtc" | "confirmBooking" | "selectedSlotId"
  > & { customerMessage: string };
  session: MctbAiBookingSession | null;
  bookingTimezone: string;
  referenceUtcIso: string;
}): VoiceNativeOrchestratorMapResult {
  const { payload, base, session, bookingTimezone, referenceUtcIso } = input;
  const offeredSlots = session?.offeredSlots ?? [];

  if (payload.action === "CANCEL_BOOKING_FLOW") {
    return { kind: "cancelled" };
  }

  if (payload.action === "SELECT_OFFERED_SLOT" || payload.action === "BOOK_OFFERED_SLOT") {
    if (!validateOfferSet(session, payload.offer_set_id)) {
      return {
        kind: "invalid_offer_set",
        message: "That offer is no longer active. Let me check the calendar again.",
      };
    }
    const slotId = payload.selected_slot_id!.trim();
    const slot = validateSelectedSlot(offeredSlots, slotId);
    if (!slot) {
      return {
        kind: "invalid_slot",
        message: "I do not have that time in the current offer. Pick one of the times I listed, or ask for a different time.",
      };
    }
    const confirmBooking =
      payload.action === "BOOK_OFFERED_SLOT" || payload.confirm_booking === true;
    const specialist: SchedulingSpecialistResult = {
      action: confirmBooking ? "CONFIRM_BOOKING" : "SELECT_OFFERED_SLOT",
      timezone: bookingTimezone,
      offered_slot_id: slotId,
      needs_clarification: false,
      customer_confirms_booking: confirmBooking,
    };
    const mapped = mapSpecialistToOrchestratorInput(specialist, base, {
      sessionHasOfferedSlots: offeredSlots.length > 0,
      offeredSlots,
      referenceUtcIso,
    });
    if (!mapped) {
      return { kind: "needs_clarification", message: "Which of those times works best?" };
    }
    return { kind: "orchestrate", input: mapped };
  }

  const findLike =
    payload.action === "FIND_AVAILABILITY" || payload.action === "CHANGE_AVAILABILITY_REQUEST";

  if (!findLike) {
    return { kind: "needs_clarification", message: "What day or time works best for you?" };
  }

  const specialist: SchedulingSpecialistResult = {
    action: payload.specific_local_time ? "CHECK_SPECIFIC_TIME" : "CHECK_AVAILABILITY",
    timezone: bookingTimezone,
    needs_clarification: false,
    requested_local_date: payload.requested_date,
    requested_local_time: payload.specific_local_time,
    time_relation: payload.time_relation || (payload.specific_local_time ? "AT" : null),
    daypart: payload.daypart,
    time_specificity: payload.specific_local_time
      ? "EXACT"
      : payload.daypart
        ? "DAYPART"
        : payload.requested_date
          ? "DATE_ONLY"
          : null,
  };

  const mapped = mapSpecialistToOrchestratorInput(specialist, base, {
    sessionHasOfferedSlots: offeredSlots.length > 0,
    offeredSlots,
    referenceUtcIso,
  });

  if (!mapped) {
    return {
      kind: "needs_clarification",
      message: "What day or time works best for you?",
    };
  }

  return { kind: "orchestrate", input: mapped };
}
