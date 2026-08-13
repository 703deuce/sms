import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  isOpenAiRealtimeNativeVoice,
  normalizeRealtimeNativeVoice,
  type OpenAiRealtimeNativeVoice,
} from "@/lib/voice/outbound/realtime-native-voices";
import { getVoiceAgentAdvanced } from "@/lib/voice/outbound/agent-config";

/** Receptionist wizard voice rows — OpenAI Realtime native voices (not ElevenLabs). */
export const RECEPTIONIST_REALTIME_VOICES = [
  {
    id: "marin",
    label: "Marin",
    badge: "Recommended",
    description: "Warm, natural, professional",
    locale: "OpenAI Realtime",
  },
  {
    id: "coral",
    label: "Coral",
    description: "Friendly and upbeat",
    locale: "OpenAI Realtime",
  },
  {
    id: "shimmer",
    label: "Shimmer",
    description: "Bright and energetic",
    locale: "OpenAI Realtime",
  },
  {
    id: "cedar",
    label: "Cedar",
    description: "Clear and confident",
    locale: "OpenAI Realtime",
  },
  {
    id: "sage",
    label: "Sage",
    description: "Calm and steady",
    locale: "OpenAI Realtime",
  },
  {
    id: "verse",
    label: "Verse",
    description: "Warm and approachable",
    locale: "OpenAI Realtime",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "Balanced and neutral",
    locale: "OpenAI Realtime",
  },
  {
    id: "echo",
    label: "Echo",
    description: "Smooth and clear",
    locale: "OpenAI Realtime",
  },
] as const;

/** Legacy ElevenLabs / Telnyx catalog ids from early wizard builds. */
const LEGACY_WIZARD_VOICE_TO_REALTIME: Record<string, OpenAiRealtimeNativeVoice> = {
  "ava-warm-us": "marin",
  "allie-ultra": "sage",
  "maya-energetic-us": "shimmer",
  "celeste-naturalhd": "cedar",
  "orion-naturalhd": "verse",
};

export function tryNormalizeWizardVoiceToRealtime(raw: string): OpenAiRealtimeNativeVoice | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (isOpenAiRealtimeNativeVoice(lower)) return lower;
  const legacy = LEGACY_WIZARD_VOICE_TO_REALTIME[trimmed] || LEGACY_WIZARD_VOICE_TO_REALTIME[lower];
  if (legacy) return legacy;
  return null;
}

export function normalizeWizardVoiceToRealtime(raw: string): OpenAiRealtimeNativeVoice {
  return tryNormalizeWizardVoiceToRealtime(raw) ?? "marin";
}

/**
 * Realtime voice stored on the agent (picker / publish). Env vars are fallback only.
 */
export function resolveConfiguredRealtimeVoice(
  config: Pick<VoiceAgentConfig, "advanced" | "voiceLanguage">,
): OpenAiRealtimeNativeVoice | undefined {
  const advanced = getVoiceAgentAdvanced(config);
  const advancedRaw = config.advanced as Record<string, unknown> | undefined;
  const compiled = advancedRaw?.receptionistCompiled as { voiceId?: string } | undefined;
  const wizard = advancedRaw?.receptionistWizard as { voiceId?: string } | undefined;

  const candidates = [
    advanced.realtimeVoice,
    config.voiceLanguage?.voiceId,
    compiled?.voiceId,
    wizard?.voiceId,
  ];

  for (const raw of candidates) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    return normalizeWizardVoiceToRealtime(trimmed);
  }

  return undefined;
}
