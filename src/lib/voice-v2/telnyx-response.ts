import { certifiedBookingHandoffPayload } from "./certified-booking-pipeline";
import type { VoiceV2FindAvailabilityResult } from "./types";

export function formatVoiceV2TelnyxToolResponse(
  result: VoiceV2FindAvailabilityResult,
): Record<string, unknown> {
  if (result.status === "AVAILABILITY_FOUND") {
    const labels = result.slots.map((s) => s.label).join(", ");
    const handoff = certifiedBookingHandoffPayload({
      offerSetId: result.offer_set_id,
      slots: result.slots.map((s) => ({
        slot_id: s.slot_id,
        label: s.label,
        spoken_label: s.label,
      })),
    });
    return {
      ok: true,
      status: "AVAILABILITY_FOUND",
      voice_v2_status: "AVAILABILITY_FOUND",
      offer_set_id: result.offer_set_id,
      speak: `I have ${labels}. Which works best for you?`,
      slots: result.slots,
      timing_ms: result.timing_ms,
      graph: result.graph,
      ...handoff,
    };
  }
  if (result.status === "NO_AVAILABILITY") {
    return {
      ok: true,
      status: "NO_AVAILABILITY",
      voice_v2_status: "NO_AVAILABILITY",
      speak: "I don't see openings in that window. Would another time work?",
      slots: [],
      timing_ms: result.timing_ms,
      graph: result.graph,
    };
  }
  return {
    ok: false,
    status: "ERROR",
    voice_v2_status: "ERROR",
    speak: "I'm having trouble checking the calendar right now.",
    error: result.error,
    timing_ms: result.timing_ms,
  };
}
