/**
 * Curated ElevenLabs receptionist voices for After-Hours / Voice V2 wizard.
 * Wizard `voiceId` = catalogId (`el:<model>:<elevenlabs_voice_id>`).
 */

import {
  catalogIdForElevenLabs,
  ELEVENLABS_SECRET_IDENTIFIER,
  type ElevenLabsCandidateModelId,
} from "@/lib/voice/elevenlabs/models";
import {
  DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
  RECEPTIONIST_TTS_MODEL,
  tryNormalizeWizardVoiceToElevenLabs,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { DEFAULT_RECEPTIONIST_VOICE_TUNING } from "@/lib/voice/elevenlabs/receptionist-voice-tuning";

export type VoiceV2WizardElevenLabsVoice = {
  /** Persisted on wizard + published agent (`el:model:voice_id`). */
  catalogId: string;
  label: string;
  description: string;
  gender: "female" | "male";
  style: string;
  elevenLabsVoiceId: string;
  modelId: ElevenLabsCandidateModelId;
  recommendedSpeed?: number;
  badge?: string;
};

const MODEL = RECEPTIONIST_TTS_MODEL as ElevenLabsCandidateModelId;

function entry(
  voiceId: string,
  label: string,
  description: string,
  gender: "female" | "male",
  style: string,
  opts?: { recommendedSpeed?: number; badge?: string },
): VoiceV2WizardElevenLabsVoice {
  return {
    catalogId: catalogIdForElevenLabs(MODEL, voiceId),
    label,
    description,
    gender,
    style,
    elevenLabsVoiceId: voiceId,
    modelId: MODEL,
    recommendedSpeed: opts?.recommendedSpeed ?? 1.08,
    badge: opts?.badge,
  };
}

/** Stable product catalog (~10). IDs verified via scripts/verify-elevenlabs-voice-catalog.mjs */
export const VOICE_V2_WIZARD_ELEVENLABS_VOICES: VoiceV2WizardElevenLabsVoice[] = [
  entry(
    DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
    "Jessica",
    "Warm, professional — default receptionist voice",
    "female",
    "Warm & professional",
    { badge: "Recommended", recommendedSpeed: 1.08 },
  ),
  entry("21m00Tcm4TlvDq8ikWAM", "Rachel", "Calm and articulate", "female", "Calm & clear"),
  entry("Bmj4Yi69e7b67di5IKVn", "Jade", "Warm, natural professional", "female", "Warm & natural"),
  entry("OZ0L6eISlOejga3XjDFt", "Talia", "Soft, caring guide", "female", "Soft & caring"),
  entry("EXAVITQu4vr4xnSDxMaL", "Bella", "Soft and friendly", "female", "Friendly & clear"),
  entry("piTKgcLEGmPE4ae6NEnA", "Nicole", "Bright and confident", "female", "Bright & confident"),
  entry("xbIuSyF7FdqvuiiHz4Rb", "Eddie", "Clear, steady male", "male", "Steady & clear"),
  entry("AaOhDHYJ1XLZk74lXhdE", "Caleb", "Warm, calm male", "male", "Warm & trustworthy"),
  entry("pNInz6obpgDQGcFmaJgB", "Adam", "Deep and steady", "male", "Calm & professional"),
  entry("TxGEqnHWrfWFTfGW9XjX", "Josh", "Warm and conversational", "male", "Conversational"),
];

export const DEFAULT_VOICE_V2_WIZARD_CATALOG_ID =
  VOICE_V2_WIZARD_ELEVENLABS_VOICES[0]?.catalogId ||
  catalogIdForElevenLabs(MODEL, DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID);

export function getVoiceV2WizardElevenLabsVoice(
  catalogId: string,
): VoiceV2WizardElevenLabsVoice | undefined {
  const id = catalogId.trim();
  return VOICE_V2_WIZARD_ELEVENLABS_VOICES.find((v) => v.catalogId === id);
}

export function resolveVoiceV2WizardVoiceForPublish(voiceId: string): VoiceV2WizardElevenLabsVoice {
  const direct = getVoiceV2WizardElevenLabsVoice(voiceId);
  if (direct) return direct;

  const elId = tryNormalizeWizardVoiceToElevenLabs(voiceId);
  if (elId) {
    const mapped = VOICE_V2_WIZARD_ELEVENLABS_VOICES.find((v) => v.elevenLabsVoiceId === elId);
    if (mapped) return mapped;
    return entry(elId, "Legacy voice", "Mapped from prior wizard selection", "female", "Professional");
  }

  throw new Error(
    `Invalid voice selection. Choose one of the curated ElevenLabs receptionist voices.`,
  );
}

export function validateVoiceV2WizardVoiceId(voiceId: string): { ok: true } | { ok: false; message: string } {
  try {
    resolveVoiceV2WizardVoiceForPublish(voiceId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid voice selection",
    };
  }
}

export function elevenLabsVoiceLanguagePublishFields(voice: VoiceV2WizardElevenLabsVoice) {
  return {
    voiceId: voice.catalogId,
    voiceProvider: "elevenlabs" as const,
    elevenLabsApiKeyRef: ELEVENLABS_SECRET_IDENTIFIER,
    elevenLabsTuning: true,
    elevenLabsStability: DEFAULT_RECEPTIONIST_VOICE_TUNING.stability,
    elevenLabsSimilarityBoost: DEFAULT_RECEPTIONIST_VOICE_TUNING.similarityBoost,
    elevenLabsStyle: DEFAULT_RECEPTIONIST_VOICE_TUNING.style,
    elevenLabsSpeakerBoost: DEFAULT_RECEPTIONIST_VOICE_TUNING.speakerBoost,
    speed: voice.recommendedSpeed ?? DEFAULT_RECEPTIONIST_VOICE_TUNING.speed,
  };
}
