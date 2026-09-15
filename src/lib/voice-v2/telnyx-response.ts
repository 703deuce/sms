import type { VoiceV2FindAvailabilityResult } from "./types";

export function formatVoiceV2TelnyxToolResponse(
  result: VoiceV2FindAvailabilityResult,
): Record<string, unknown> {
  if (result.status === "AVAILABILITY_FOUND") {
    const labels = result.slots.map((s) => s.label).join(", ");
    return {
      ok: true,
      status: "AVAILABILITY_FOUND",
      voice_v2_status: "AVAILABILITY_FOUND",
      offer_set_id: result.offer_set_id,
      speak: `I have ${labels}. Which works best for you?`,
      slots: result.slots,
      timing_ms: result.timing_ms,
      graph: result.graph,
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
