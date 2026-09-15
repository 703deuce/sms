import type { executeVoiceV2BookOfferedSlot } from "./book-offered-slot";

type BookResult = Awaited<ReturnType<typeof executeVoiceV2BookOfferedSlot>>;

export function formatVoiceV2BookTelnyxResponse(result: BookResult): Record<string, unknown> {
  if (result.status === "BOOKING_CONFIRMED") {
    return {
      ok: true,
      status: "BOOKING_CONFIRMED",
      voice_v2_status: "BOOKING_CONFIRMED",
      speak: result.spoken_confirmation,
      slot_id: result.slot_id,
      offer_set_id: result.offer_set_id,
      event_id: result.event_id,
      timing_ms: result.timing_ms,
      graph: result.graph,
    };
  }
  if (result.status === "SLOT_UNAVAILABLE") {
    return {
      ok: false,
      status: "SLOT_UNAVAILABLE",
      voice_v2_status: "SLOT_UNAVAILABLE",
      speak: "That time just filled up. I can check another opening if you'd like.",
      error: result.error,
      timing_ms: result.timing_ms,
    };
  }
  return {
    ok: false,
    status: result.status,
    voice_v2_status: result.status,
    speak: "I wasn't able to complete that booking just now.",
    error: result.error,
    timing_ms: result.timing_ms,
  };
}
