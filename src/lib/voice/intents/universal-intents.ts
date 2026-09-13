/**
 * Voice channel intents — aligned with AI Lead Recovery taxonomy where possible.
 * Voice may add channel-specific intents (e.g. TRANSFER_REQUEST).
 */
import { LEAD_RECOVERY_INTENTS } from "@/lib/mctb/lead-recovery/types";

export const VOICE_CHANNEL_ONLY_INTENTS = ["TRANSFER_REQUEST", "VOICEMAIL_REQUEST"] as const;

export type VoiceChannelOnlyIntent = (typeof VOICE_CHANNEL_ONLY_INTENTS)[number];

export const VOICE_UNIVERSAL_INTENTS = [
  ...LEAD_RECOVERY_INTENTS,
  ...VOICE_CHANNEL_ONLY_INTENTS,
] as const;

export type VoiceUniversalIntent = (typeof VOICE_UNIVERSAL_INTENTS)[number];
