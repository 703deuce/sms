/**
 * Build Telnyx Assistants voice_settings for ElevenLabs TTS.
 * Architecture: Telnyx Assistant → ElevenLabs TTS via api_key_ref (not full EL agent import).
 */

import {
  buildElevenLabsProviderVoice,
  getCandidateModel,
  isElevenLabsCandidateModelId,
  isElevenLabsProviderVoice,
  parseElevenLabsCatalogId,
  parseElevenLabsProviderVoice,
  type ElevenLabsCandidateModelId,
} from "./models";
import { ELEVENLABS_SECRET_IDENTIFIER } from "./models";
import type { ElevenLabsModelInfo } from "./client";

export type ElevenLabsVoiceSettingsInput = {
  /** Catalog id `el:<model>:<voiceId>`, provider string, or raw voice id + modelId */
  voiceRef?: string | null;
  modelId?: string | null;
  voiceId?: string | null;
  apiKeyRef?: string | null;
  /** When true, include optional tuning fields (after basic voice works). */
  includeTuning?: boolean;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
  useSpeakerBoost?: boolean | null;
  /** Model capabilities from ElevenLabs /v1/models */
  modelCapabilities?: Pick<
    ElevenLabsModelInfo,
    "can_use_style" | "can_use_speaker_boost"
  > | null;
};

export type BuiltElevenLabsVoiceSettings = {
  voice_settings: Record<string, unknown>;
  providerVoiceId: string;
  modelId: ElevenLabsCandidateModelId | string;
  voiceId: string;
  apiKeyRef: string;
  isElevenLabs: true;
};

export function resolveElevenLabsParts(input: ElevenLabsVoiceSettingsInput): {
  modelId: string;
  voiceId: string;
} {
  const catalog = parseElevenLabsCatalogId(String(input.voiceRef || ""));
  if (catalog.ok && catalog.modelId && catalog.voiceId) {
    return { modelId: catalog.modelId, voiceId: catalog.voiceId };
  }
  if (input.voiceRef && isElevenLabsProviderVoice(input.voiceRef)) {
    const parsed = parseElevenLabsProviderVoice(input.voiceRef);
    if (parsed.ok && parsed.modelId && parsed.voiceId) {
      return { modelId: parsed.modelId, voiceId: parsed.voiceId };
    }
  }
  const modelId = String(input.modelId || "").trim();
  const voiceId = String(input.voiceId || "").trim();
  if (!modelId || !voiceId) {
    throw new Error(
      "ElevenLabs requires model_id and voice_id (or el:<model>:<voiceId> / ElevenLabs.<model>.<voiceId>)",
    );
  }
  return { modelId, voiceId };
}

export function validateElevenLabsBeforePatch(input: {
  assistantId?: string | null;
  apiKeyRef?: string | null;
  modelId: string;
  voiceId: string;
  providerVoiceId: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.assistantId) {
    return { ok: false, error: "assistant_id is required" };
  }
  if (!input.apiKeyRef) {
    return { ok: false, error: "ElevenLabs api_key_ref (Telnyx secret identifier) is required" };
  }
  if (!input.voiceId) {
    return { ok: false, error: "ElevenLabs voice_id is required" };
  }
  if (!isElevenLabsCandidateModelId(input.modelId) && !getCandidateModel(input.modelId)) {
    // Allow other TTS models discovered on the account, but warn via exact id.
    if (!String(input.modelId).startsWith("eleven_")) {
      return {
        ok: false,
        error: `Unsupported model_id ${input.modelId}`,
      };
    }
  }
  const parsed = parseElevenLabsProviderVoice(input.providerVoiceId);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error || "Invalid ElevenLabs voice string" };
  }
  if (parsed.modelId !== input.modelId || parsed.voiceId !== input.voiceId) {
    return { ok: false, error: "Provider voice string does not match model/voice ids" };
  }
  return { ok: true };
}

/**
 * Minimal payload first (voice + api_key_ref). Optional tuning afterwards.
 * Never enables expressive_mode (Telnyx Ultra only).
 *
 * Important: Telnyx MERGES voice_settings across PATCHes. After switching from
 * Ultra/NaturalHD, leftovers like expressive_mode / language_boost / voice_speed
 * can remain on the assistant. Explicitly clear those for ElevenLabs.
 */
export function buildElevenLabsVoiceSettings(
  input: ElevenLabsVoiceSettingsInput,
): BuiltElevenLabsVoiceSettings {
  const { modelId, voiceId } = resolveElevenLabsParts(input);
  const providerVoiceId = buildElevenLabsProviderVoice(modelId, voiceId);
  const apiKeyRef = String(input.apiKeyRef || ELEVENLABS_SECRET_IDENTIFIER).trim();
  if (!apiKeyRef) {
    throw new Error("api_key_ref is required for ElevenLabs");
  }

  const caps = input.modelCapabilities;
  // Account discovery: Flash + v3 report can_use_style/speaker_boost = false.
  const canStyle = caps ? caps.can_use_style : modelId === "eleven_multilingual_v2";
  const canBoost = caps
    ? caps.can_use_speaker_boost
    : modelId === "eleven_multilingual_v2";

  const voice_settings: Record<string, unknown> = {
    voice: providerVoiceId,
    api_key_ref: apiKeyRef,
    // Clear Ultra / NaturalHD leftovers that Telnyx otherwise merges through.
    expressive_mode: false,
    language_boost: null,
    // Natural-only speed field — reset so a prior 1.4 Ultra speed does not linger.
    voice_speed: 1,
  };

  // Always neutralize unsupported ElevenLabs knobs so leftovers cannot be relayed.
  voice_settings.use_speaker_boost = canBoost
    ? input.useSpeakerBoost == null
      ? true
      : Boolean(input.useSpeakerBoost)
    : false;
  voice_settings.style = canStyle
    ? input.style != null && Number.isFinite(input.style)
      ? Number(input.style)
      : modelId === "eleven_multilingual_v2"
        ? 0.25
        : 0.2
    : 0;

  if (input.includeTuning) {
    const stability =
      input.stability != null && Number.isFinite(input.stability)
        ? Number(input.stability)
        : 0.5;
    const similarity =
      input.similarityBoost != null && Number.isFinite(input.similarityBoost)
        ? Number(input.similarityBoost)
        : 0.75;
    // Telnyx maps ElevenLabs "stability" to voice_settings.temperature
    voice_settings.temperature = stability;
    voice_settings.similarity_boost = similarity;
  } else {
    // Neutral defaults — avoid leaving stale similarity_boost from prior Ultra/EL sync.
    voice_settings.similarity_boost = 0.75;
    voice_settings.temperature = 0.5;
  }

  return {
    voice_settings,
    providerVoiceId,
    modelId,
    voiceId,
    apiKeyRef,
    isElevenLabs: true,
  };
}
