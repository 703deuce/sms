import type { VoiceAgentConfig } from "@/lib/voice/types";

/** Legacy Voice V2 PSTN modes removed — Voice V3 Basic is the only live booking runtime. */
export function isVoiceV2PstnLiveBookingMode(_config?: VoiceAgentConfig | null): boolean {
  return false;
}

export function isVoiceV2PstnOneAmyMode(_config?: VoiceAgentConfig | null): boolean {
  return false;
}

export function resolveVoiceV2BookingStrategy(
  _config?: VoiceAgentConfig | null,
): "MICROSOFT_365" | "CALENDLY" | "SEND_LINK" | "NONE" {
  return "MICROSOFT_365";
}
