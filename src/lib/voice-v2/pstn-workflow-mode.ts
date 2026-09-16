import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  isVoiceV2PstnLiveBookingMode as strategyLiveBooking,
  isVoiceV2PstnOneAmyMode,
  resolveVoiceV2BookingStrategy,
} from "@/lib/voice-v2/booking-strategy";

/** When true, Telnyx workflow uses Voice V2 find/book/save (not legacy booking turn). */
export function isVoiceV2PstnLiveBookingMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  return strategyLiveBooking(config);
}

export { isVoiceV2PstnOneAmyMode, resolveVoiceV2BookingStrategy };
