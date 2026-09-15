import type { VoiceAgentConfig } from "@/lib/voice/types";

/** When true, Telnyx workflow uses Voice V2 find/book/save (not legacy booking turn / after-hours link-only). */
export function isVoiceV2PstnLiveBookingMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.voiceV2PstnLiveBooking === true;
}
