/**
 * ElevenLabs model candidates for Telnyx AI Assistant TTS.
 * Do not assume Telnyx accepts every ElevenLabs model — verify via PATCH + read-back.
 */

export const ELEVENLABS_SECRET_IDENTIFIER = "elevenlabs_transovo";

/** Official candidate model IDs to discover + test through Telnyx. */
export const ELEVENLABS_CANDIDATE_MODELS = [
  {
    modelId: "eleven_flash_v2_5",
    shortLabel: "Flash v2.5",
    uiTier: "elevenlabs_flash" as const,
    uiTierLabel: "ElevenLabs Flash — Premium voice, optimized for speed",
    purpose: "low-latency real-time voice agent",
  },
  {
    modelId: "eleven_multilingual_v2",
    shortLabel: "Multilingual v2",
    uiTier: "elevenlabs_multilingual_v2" as const,
    uiTierLabel: "ElevenLabs Multilingual v2 — Highest-quality live voice",
    purpose: "stable high-quality speech",
  },
  {
    modelId: "eleven_v3",
    shortLabel: "Eleven v3",
    uiTier: "elevenlabs_v3" as const,
    // Telnyx Assistants relay ElevenLabs over TTS WebSockets; eleven_v3 does not
    // support WS. Config may PATCH OK but live greeting audio fails.
    uiTierLabel:
      "ElevenLabs v3 — Expressive (not for live Telnyx phone; use Multilingual v2)",
    purpose:
      "most expressive / emotionally rich TTS — content/HTTP only, not Telnyx live WS",
  },
] as const;

/** Live Telnyx Assistants: Flash (speed) + Multilingual v2 (quality). Not v3. */
export const ELEVENLABS_LIVE_TELNYX_MODELS = [
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
] as const;

export type ElevenLabsCandidateModelId =
  (typeof ELEVENLABS_CANDIDATE_MODELS)[number]["modelId"];

export type ElevenLabsUiTier =
  (typeof ELEVENLABS_CANDIDATE_MODELS)[number]["uiTier"];

export function isElevenLabsCandidateModelId(
  value: string | undefined | null,
): value is ElevenLabsCandidateModelId {
  return ELEVENLABS_CANDIDATE_MODELS.some((m) => m.modelId === value);
}

export function getCandidateModel(modelId: string) {
  return ELEVENLABS_CANDIDATE_MODELS.find((m) => m.modelId === modelId) || null;
}

/**
 * Telnyx Assistants voice string:
 * ElevenLabs.<ModelId>.<VoiceId>
 */
export function buildElevenLabsProviderVoice(
  modelId: string,
  voiceId: string,
): string {
  const model = String(modelId || "").trim();
  const voice = String(voiceId || "").trim();
  if (!model || !voice) {
    throw new Error("ElevenLabs voice requires model_id and voice_id");
  }
  if (voice.includes(" ") || voice.includes(".")) {
    // Voice IDs are opaque alphanumerics; reject obvious display names.
    if (/^[A-Za-z]+$/.test(voice) && voice.length < 12) {
      throw new Error(
        `Rejecting likely display name "${voice}" — use the exact ElevenLabs voice_id`,
      );
    }
  }
  return `ElevenLabs.${model}.${voice}`;
}

export function parseElevenLabsProviderVoice(voice: string): {
  ok: boolean;
  modelId?: string;
  voiceId?: string;
  error?: string;
} {
  const raw = String(voice || "").trim();
  if (!raw.startsWith("ElevenLabs.")) {
    return { ok: false, error: "Voice must begin with ElevenLabs." };
  }
  const rest = raw.slice("ElevenLabs.".length);
  const firstDot = rest.indexOf(".");
  if (firstDot <= 0 || firstDot === rest.length - 1) {
    return {
      ok: false,
      error: "Expected ElevenLabs.<model_id>.<voice_id>",
    };
  }
  const modelId = rest.slice(0, firstDot).trim();
  const voiceId = rest.slice(firstDot + 1).trim();
  if (!modelId || !voiceId) {
    return { ok: false, error: "Incomplete ElevenLabs voice string" };
  }
  return { ok: true, modelId, voiceId };
}

export function isElevenLabsProviderVoice(voice: string | undefined | null) {
  return String(voice || "").startsWith("ElevenLabs.");
}

export function catalogIdForElevenLabs(modelId: string, voiceId: string) {
  return `el:${modelId}:${voiceId}`;
}

export function parseElevenLabsCatalogId(catalogId: string): {
  ok: boolean;
  modelId?: string;
  voiceId?: string;
} {
  const raw = String(catalogId || "").trim();
  if (!raw.startsWith("el:")) return { ok: false };
  const parts = raw.split(":");
  if (parts.length < 3) return { ok: false };
  const modelId = parts[1];
  const voiceId = parts.slice(2).join(":");
  if (!modelId || !voiceId) return { ok: false };
  return { ok: true, modelId, voiceId };
}
