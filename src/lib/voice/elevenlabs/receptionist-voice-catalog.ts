/**
 * Curated ElevenLabs voices for the generic AI Receptionist builder.
 * Runtime and UI depend on stable voice_id — never on display labels.
 *
 * IDs are ElevenLabs premade voices (stable). Swap entries here after auditing
 * your ElevenLabs account; the UI reads this catalog only.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export type ReceptionistElevenLabsVoice = {
  /** ElevenLabs voice_id — persisted on draft/published agent versions */
  id: string;
  label: string;
  description: string;
  gender: "female" | "male";
  style: "warm" | "professional" | "bright" | "calm" | "neutral";
  accent: string;
  badge?: string;
  enabled: boolean;
};

/** Default when migration cannot map a legacy OpenAI Realtime voice. */
export const DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID = "cgSgspJ2msm6clMCkdW9";

export const RECEPTIONIST_ELEVENLABS_VOICES: ReceptionistElevenLabsVoice[] = [
  {
    id: "cgSgspJ2msm6clMCkdW9",
    label: "Jessica",
    description: "Warm, professional — default receptionist voice",
    gender: "female",
    style: "warm",
    accent: "American",
    badge: "Recommended",
    enabled: true,
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    label: "Rachel",
    description: "Calm and articulate",
    gender: "female",
    style: "calm",
    accent: "American",
    enabled: true,
  },
  {
    id: "Bmj4Yi69e7b67di5IKVn",
    label: "Jade",
    description: "Warm, natural professional",
    gender: "female",
    style: "warm",
    accent: "American",
    enabled: true,
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Bella",
    description: "Soft and friendly",
    gender: "female",
    style: "warm",
    accent: "American",
    enabled: true,
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    label: "Elli",
    description: "Young and energetic",
    gender: "female",
    style: "bright",
    accent: "American",
    enabled: true,
  },
  {
    id: "piTKgcLEGmPE4ae6NEnA",
    label: "Nicole",
    description: "Bright and confident",
    gender: "female",
    style: "bright",
    accent: "American",
    enabled: true,
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    label: "Adam",
    description: "Deep and steady",
    gender: "male",
    style: "professional",
    accent: "American",
    enabled: true,
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    label: "Josh",
    description: "Warm and conversational",
    gender: "male",
    style: "warm",
    accent: "American",
    enabled: true,
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    label: "Antoni",
    description: "Clear and well-rounded",
    gender: "male",
    style: "neutral",
    accent: "American",
    enabled: true,
  },
  {
    id: "VR6AewLTigWG4xSOukaG",
    label: "Arnold",
    description: "Crisp and authoritative",
    gender: "male",
    style: "professional",
    accent: "American",
    enabled: true,
  },
  {
    id: "yoZ06aMxZJJ28mfd3POQ",
    label: "Sam",
    description: "Casual and approachable",
    gender: "male",
    style: "calm",
    accent: "American",
    enabled: true,
  },
];

export const RECEPTIONIST_TTS_MODEL = "eleven_flash_v2_5";

const ENABLED_IDS = new Set(
  RECEPTIONIST_ELEVENLABS_VOICES.filter((v) => v.enabled).map((v) => v.id),
);

/** OpenAI Realtime native voices from early receptionist builds → ElevenLabs premade IDs */
const LEGACY_OPENAI_REALTIME_TO_ELEVENLABS: Record<string, string> = {
  marin: "cgSgspJ2msm6clMCkdW9",
  coral: "EXAVITQu4vr4xnSDxMaL",
  shimmer: "piTKgcLEGmPE4ae6NEnA",
  cedar: "VR6AewLTigWG4xSOukaG",
  sage: "21m00Tcm4TlvDq8ikWAM",
  verse: "TxGEqnHWrfWFTfGW9XjX",
  alloy: "ErXwobaYiN019PkySvjV",
  echo: "pNInz6obpgDQGcFmaJgB",
};

/** Early wizard Telnyx/ElevenLabs catalog aliases */
const LEGACY_WIZARD_TO_ELEVENLABS: Record<string, string> = {
  "ava-warm-us": "cgSgspJ2msm6clMCkdW9",
  "allie-ultra": "21m00Tcm4TlvDq8ikWAM",
  "maya-energetic-us": "piTKgcLEGmPE4ae6NEnA",
  "celeste-naturalhd": "EXAVITQu4vr4xnSDxMaL",
  "orion-naturalhd": "TxGEqnHWrfWFTfGW9XjX",
};

export function getReceptionistElevenLabsVoice(voiceId: string): ReceptionistElevenLabsVoice | undefined {
  return RECEPTIONIST_ELEVENLABS_VOICES.find((v) => v.id === voiceId);
}

export function isReceptionistElevenLabsVoiceId(raw: string): boolean {
  return ENABLED_IDS.has(raw.trim());
}

export function tryNormalizeWizardVoiceToElevenLabs(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isReceptionistElevenLabsVoiceId(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const fromOpenAi = LEGACY_OPENAI_REALTIME_TO_ELEVENLABS[lower];
  if (fromOpenAi) return fromOpenAi;
  const fromWizard =
    LEGACY_WIZARD_TO_ELEVENLABS[trimmed] || LEGACY_WIZARD_TO_ELEVENLABS[lower];
  if (fromWizard) return fromWizard;
  return null;
}

export function normalizeWizardVoiceToElevenLabs(raw: string): string {
  return tryNormalizeWizardVoiceToElevenLabs(raw) ?? DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID;
}

export function listEnabledReceptionistElevenLabsVoices(): ReceptionistElevenLabsVoice[] {
  return RECEPTIONIST_ELEVENLABS_VOICES.filter((v) => v.enabled);
}

/** ElevenLabs voice_id from published agent config — not from env. */
export function resolveConfiguredElevenLabsVoice(
  config: Pick<VoiceAgentConfig, "advanced" | "voiceLanguage">,
): string | undefined {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const compiled = advanced.receptionistCompiled as { voiceId?: string } | undefined;
  const wizard = advanced.receptionistWizard as { voiceId?: string } | undefined;

  const candidates = [
    advanced.elevenLabsVoiceId,
    config.voiceLanguage?.voiceId,
    compiled?.voiceId,
    wizard?.voiceId,
    advanced.realtimeVoice,
  ];

  for (const raw of candidates) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    const normalized = tryNormalizeWizardVoiceToElevenLabs(trimmed);
    if (normalized) return normalized;
  }

  return undefined;
}
