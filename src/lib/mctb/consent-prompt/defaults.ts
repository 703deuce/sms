import { DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID } from "@/lib/voice/elevenlabs/receptionist-voice-catalog";

export function defaultMctbConsentScript(businessName = "our business"): string {
  const name = businessName.trim() || "our business";
  return `Hi, you've reached ${name}. Sorry we couldn't get to the phone. If you'd like us to text you back so we can help, press 1 now.`;
}

export const DEFAULT_MCTB_CONSENT_VOICE_ID = DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID;
