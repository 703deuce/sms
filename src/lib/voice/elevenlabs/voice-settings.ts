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
 * Never sets expressive_mode (Telnyx Ultra only).
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

  const voice_settings: Record<string, unknown> = {
    voice: providerVoiceId,
    api_key_ref: apiKeyRef,
  };

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

    const caps = input.modelCapabilities;
    const styleDefault = modelId === "eleven_multilingual_v2" ? 0.25 : 0.2;
    const canStyle = caps ? caps.can_use_style : true;
    const canBoost = caps ? caps.can_use_speaker_boost : true;
    if (canStyle) {
      voice_settings.style =
        input.style != null && Number.isFinite(input.style)
          ? Number(input.style)
          : styleDefault;
    }
    if (canBoost) {
      voice_settings.use_speaker_boost =
        input.useSpeakerBoost == null ? true : Boolean(input.useSpeakerBoost);
    }
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
