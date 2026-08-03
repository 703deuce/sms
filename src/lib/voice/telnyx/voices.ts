/**
 * Telnyx AI Assistant voice catalog + voice_settings helpers.
 *
 * Ultra format: Telnyx.Ultra.<voice_id>
 * ElevenLabs format: ElevenLabs.<model_id>.<voice_id> + api_key_ref
 * Standard (Natural / NaturalHD) remains the safe default / fallback.
 *
 * History: Ultra was previously remapped to NaturalHD after Assistants returned
 * "Voice not found". That remap made the UI lie about the live voice. We now
 * send Ultra as selected, surface Telnyx errors, and keep NaturalHD as fallback.
 */

import {
  isElevenLabsProviderVoice,
  parseElevenLabsCatalogId,
} from "@/lib/voice/elevenlabs/models";
import { buildElevenLabsVoiceSettings } from "@/lib/voice/elevenlabs/voice-settings";

export type VoiceQualityTier = "premium" | "standard" | "economy";
export type VoiceCostTier = "standard" | "low" | "premium_provider";
export type VoiceUiTier =
  | "standard"
  | "ultra"
  | "elevenlabs_flash"
  | "elevenlabs_multilingual_v2"
  | "elevenlabs_v3";

export type CuratedVoice = {
  /** Stable catalog ID saved on the agent (not the raw Telnyx string). */
  catalogId: string;
  /** Customer-facing name */
  displayName: string;
  /** Short style blurb */
  style: string;
  provider: "telnyx";
  /** Exact Telnyx voice_settings.voice string */
  providerVoiceId: string;
  model: "Ultra" | "NaturalHD" | "Natural" | "xAI";
  language: string;
  locale: string;
  gender: "female" | "male" | "neutral";
  qualityTier: VoiceQualityTier;
  costTier: VoiceCostTier;
  /** UI grouping: Standard Voice vs Ultra Voice */
  uiTier: VoiceUiTier;
  supportsSpeed: boolean;
  supportsExpressive: boolean;
  enabled: boolean;
  /**
   * When false, UI may still preview via TTS REST but must not mark as
   * assistant-ready until a live Assistants update succeeds.
   */
  assistantCompatible?: boolean;
  previewOnly?: boolean;
  previewText: string;
};

export const DEFAULT_VOICE_PREVIEW_TEXT =
  "Hi, thanks for calling Transovo. I can answer questions, take a message, or help connect you with the right person.";

/**
 * Documented Telnyx Ultra voices for Assistants.
 * Assistants require Telnyx.Ultra.<uuid> — short names like "Clara" alone are rejected.
 * Source: https://developers.telnyx.com/docs/tts-stt/tts-available-voices
 */
export const DOCUMENTED_ULTRA_VOICES = [
  {
    catalogId: "clara-ultra",
    displayName: "Clara",
    style: "Instructor — expressive Ultra US English",
    providerVoiceId: "Telnyx.Ultra.01eaafa9-308a-4276-a017-6ab0cf061b1f",
    locale: "en-US",
    gender: "female" as const,
  },
  {
    catalogId: "callie-ultra",
    displayName: "Callie",
    style: "Encourager — expressive Ultra US English",
    providerVoiceId: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    locale: "en-US",
    gender: "female" as const,
  },
  {
    catalogId: "asher-ultra",
    displayName: "Asher",
    style: "Podcaster — expressive Ultra US English",
    providerVoiceId: "Telnyx.Ultra.00967b2f-88a6-4a31-8153-110a92134b9f",
    locale: "en-US",
    gender: "male" as const,
  },
  {
    catalogId: "cindy-ultra",
    displayName: "Cindy",
    style: "Receptionist — expressive Ultra US English",
    providerVoiceId: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    locale: "en-US",
    gender: "female" as const,
  },
  {
    catalogId: "allie-ultra",
    displayName: "Allie",
    style: "Natural Conversationalist — receptionist A/B shortlist",
    providerVoiceId: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    locale: "en-US",
    gender: "female" as const,
  },
  {
    catalogId: "maia-ultra",
    displayName: "Maia",
    style: "Agile Support — stand-in for missing Mia Agent (catalog 2026-08-03)",
    providerVoiceId: "Telnyx.Ultra.5a033900-2ed6-4fd4-a257-707f2688e713",
    locale: "en-US",
    gender: "female" as const,
  },
  {
    catalogId: "howard-ultra",
    displayName: "Howard",
    style: "Approachable Man — transactional male A/B option",
    providerVoiceId: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    locale: "en-US",
    gender: "male" as const,
  },
  {
    catalogId: "jasper-ultra",
    displayName: "Jasper",
    style: "Service Specialist — sales-adjacent male A/B option",
    providerVoiceId: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    locale: "en-US",
    gender: "male" as const,
  },
] as const;

/** @deprecated short names — Assistants reject these; use DOCUMENTED_ULTRA_VOICES */
export const DOCUMENTED_ULTRA_VOICE_IDS = DOCUMENTED_ULTRA_VOICES.map(
  (v) => v.providerVoiceId,
);

export const CURATED_VOICE_CATALOG: CuratedVoice[] = [
  {
    catalogId: "ava-warm-us",
    displayName: "Ava",
    style: "Warm, professional US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.astra",
    model: "NaturalHD",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "standard",
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "maya-energetic-us",
    displayName: "Maya",
    style: "Clear, energetic US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.luna",
    model: "NaturalHD",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "standard",
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "marcus-confident-us",
    displayName: "Marcus",
    style: "Confident, conversational US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.albion",
    model: "NaturalHD",
    language: "en",
    locale: "en-US",
    gender: "male",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "standard",
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "sofia-friendly-us",
    displayName: "Sofia",
    style: "Friendly, approachable US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.andromeda",
    model: "NaturalHD",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "standard",
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "elise-french",
    displayName: "Elise",
    style: "Friendly French (fr-FR)",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.amarante",
    model: "NaturalHD",
    language: "fr",
    locale: "fr-FR",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "standard",
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText:
      "Bonjour, merci d'appeler Transovo. Je peux répondre à vos questions ou prendre un message.",
  },
  // Ultra — Assistants require Telnyx.Ultra.<uuid> (short names like Clara fail with 10015).
  {
    catalogId: "clara-ultra",
    displayName: "Clara",
    style: "Instructor — expressive Ultra US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.01eaafa9-308a-4276-a017-6ab0cf061b1f",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "callie-ultra",
    displayName: "Callie",
    style: "Encourager — expressive Ultra US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "asher-ultra",
    displayName: "Asher",
    style: "Podcaster — expressive Ultra US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.00967b2f-88a6-4a31-8153-110a92134b9f",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "male",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "cindy-ultra",
    displayName: "Cindy",
    style: "Receptionist — expressive Ultra US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "allie-ultra",
    displayName: "Allie",
    style: "Natural Conversationalist — receptionist A/B shortlist",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "maia-ultra",
    displayName: "Maia",
    style: "Agile Support — stand-in for missing Mia Agent",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.5a033900-2ed6-4fd4-a257-707f2688e713",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "howard-ultra",
    displayName: "Howard",
    style: "Approachable Man — transactional male A/B option",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "male",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "jasper-ultra",
    displayName: "Jasper",
    style: "Service Specialist — sales-adjacent male A/B option",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "male",
    qualityTier: "premium",
    costTier: "standard",
    uiTier: "ultra",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "eve-xai-preview",
    displayName: "Eve (xAI preview)",
    style: "xAI expressive — preview clip for quality comparison",
    provider: "telnyx",
    providerVoiceId: "xAI.eve",
    model: "xAI",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "premium_provider",
    uiTier: "ultra",
    supportsSpeed: false,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: false,
    previewOnly: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
];

/** Production default — NaturalHD Astra (catalog: Ava). Safe fallback. */
export const DEFAULT_CATALOG_VOICE_ID = "ava-warm-us";
export const FALLBACK_PROVIDER_VOICE_ID = "Telnyx.NaturalHD.astra";

export function getCuratedVoice(catalogOrProviderId: string | undefined | null) {
  if (!catalogOrProviderId) {
    return CURATED_VOICE_CATALOG.find((v) => v.catalogId === DEFAULT_CATALOG_VOICE_ID)!;
  }
  const byCatalog = CURATED_VOICE_CATALOG.find((v) => v.catalogId === catalogOrProviderId);
  if (byCatalog) return byCatalog;
  const byProvider = CURATED_VOICE_CATALOG.find(
    (v) => v.providerVoiceId === catalogOrProviderId,
  );
  if (byProvider) return byProvider;
  return null;
}

/**
 * Validate Ultra provider string before Assistants update.
 * Requires Telnyx.Ultra.<voice_id> with a non-empty voice_id segment.
 */
export function validateUltraProviderVoiceId(voice: string): {
  ok: boolean;
  voiceId?: string;
  error?: string;
} {
  const raw = String(voice || "").trim();
  if (!raw.startsWith("Telnyx.Ultra.")) {
    return { ok: false, error: "Ultra voice must begin with Telnyx.Ultra." };
  }
  const voiceId = raw.slice("Telnyx.Ultra.".length).trim();
  if (!voiceId || voiceId.includes(" ")) {
    return {
      ok: false,
      error:
        "Ultra voice requires a voice_id after Telnyx.Ultra. (Assistants use UUID ids)",
    };
  }
  if (voiceId.toLowerCase() === "ultra" || raw === "Telnyx.Ultra") {
    return {
      ok: false,
      error: "Incomplete Ultra voice — use Telnyx.Ultra.<voice_id>, not Telnyx.Ultra alone",
    };
  }
  return { ok: true, voiceId };
}

export function isUltraProviderVoice(voice: string | undefined | null) {
  return String(voice || "").startsWith("Telnyx.Ultra.");
}

/**
 * Resolve the exact provider voice string for AI Assistants / live calls.
 * Does NOT silently remap Ultra → NaturalHD (that previously hid failures).
 * Preview-only / incompatible catalog entries still fall back to NaturalHD.
 */
export function resolveProviderVoiceId(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) {
    if (v.previewOnly || v.assistantCompatible === false) {
      return FALLBACK_PROVIDER_VOICE_ID;
    }
    return v.providerVoiceId;
  }
  const raw = String(catalogOrProviderId || "").trim();
  // Legacy short names (Telnyx.Ultra.Clara) are invalid for Assistants — map to UUID catalog
  // BEFORE accepting any Telnyx.Ultra.* string (short names pass format validation).
  const legacyShort: Record<string, string> = {
    "Telnyx.Ultra.Clara": "Telnyx.Ultra.01eaafa9-308a-4276-a017-6ab0cf061b1f",
    "Telnyx.Ultra.Callie": "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    "Telnyx.Ultra.Asher": "Telnyx.Ultra.00967b2f-88a6-4a31-8153-110a92134b9f",
    "Telnyx.Ultra.Cindy": "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    "Telnyx.Ultra.clara": "Telnyx.Ultra.01eaafa9-308a-4276-a017-6ab0cf061b1f",
    "Telnyx.Ultra.callie": "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    "Telnyx.Ultra.asher": "Telnyx.Ultra.00967b2f-88a6-4a31-8153-110a92134b9f",
    "Telnyx.Ultra.cindy": "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    "Telnyx.Ultra.Nova": FALLBACK_PROVIDER_VOICE_ID,
  };
  if (legacyShort[raw]) return legacyShort[raw];
  if (raw.startsWith("Telnyx.Ultra.")) {
    const check = validateUltraProviderVoiceId(raw);
    if (check.ok) return raw;
    return FALLBACK_PROVIDER_VOICE_ID;
  }
  if (raw.startsWith("Telnyx.NaturalHD.") || raw.startsWith("Telnyx.Natural.")) {
    return raw;
  }
  // xAI stays preview-only until explicitly validated for Assistants.
  if (raw.startsWith("xAI.")) {
    return FALLBACK_PROVIDER_VOICE_ID;
  }
  return FALLBACK_PROVIDER_VOICE_ID;
}

/**
 * Voice id for TTS preview clips — keeps Ultra/xAI so quality compare is real.
 */
export function resolvePreviewVoiceId(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) return v.providerVoiceId;
  const raw = String(catalogOrProviderId || "").trim();
  if (
    raw.startsWith("Telnyx.NaturalHD.") ||
    raw.startsWith("Telnyx.Natural.") ||
    raw.startsWith("Telnyx.Ultra.") ||
    raw.startsWith("xAI.")
  ) {
    return raw;
  }
  return FALLBACK_PROVIDER_VOICE_ID;
}

export function isUltraVoice(catalogOrProviderId: string | undefined | null) {
  const curated = getCuratedVoice(catalogOrProviderId);
  if (curated) return curated.model === "Ultra";
  return isUltraProviderVoice(String(catalogOrProviderId || ""));
}

export function voiceLabel(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) return `${v.displayName} — ${v.style}`;
  const raw = String(catalogOrProviderId || "");
  if (!raw) return "Ava — Warm, professional US English";
  if (raw.startsWith("el:")) {
    const parts = raw.split(":");
    return `${parts[2] || "ElevenLabs"} (${parts[1] || "model"})`;
  }
  if (raw.startsWith("ElevenLabs.")) {
    return raw.split(".").slice(-1)[0] || raw;
  }
  return raw.split(".").pop() || raw;
}

export function voiceUiTierLabel(catalogOrProviderId: string | undefined | null) {
  const raw = String(catalogOrProviderId || "");
  if (raw.startsWith("el:") || raw.startsWith("ElevenLabs.")) {
    if (raw.includes("eleven_flash_v2_5")) {
      return "ElevenLabs Flash — Premium voice, optimized for speed";
    }
    if (raw.includes("eleven_multilingual_v2")) {
      return "ElevenLabs Multilingual v2 — Highest-quality live voice";
    }
    if (raw.includes("eleven_v3")) {
      return "ElevenLabs v3 — Most expressive ElevenLabs voice";
    }
    return "ElevenLabs Voice";
  }
  const v = getCuratedVoice(catalogOrProviderId);
  if (v?.uiTier === "ultra" || isUltraVoice(catalogOrProviderId)) {
    return "Ultra — Fast, natural, included";
  }
  return "Standard Voice";
}

export function isApprovedVoiceId(id: string) {
  if (CURATED_VOICE_CATALOG.some((v) => v.catalogId === id || v.providerVoiceId === id)) {
    return true;
  }
  return (
    id.startsWith("Telnyx.NaturalHD.") ||
    id.startsWith("Telnyx.Natural.") ||
    id.startsWith("Telnyx.Ultra.") ||
    id.startsWith("xAI.") ||
    id.startsWith("ElevenLabs.") ||
    id.startsWith("el:")
  );
}

export type AssistantVoiceSettingsInput = {
  /** Catalog id or provider voice string */
  voiceRef: string | undefined | null;
  speed?: number | null;
  expressiveMode?: boolean | null;
  volume?: number | null;
  /** Telnyx integration secret identifier for ElevenLabs */
  apiKeyRef?: string | null;
  /** When true, include ElevenLabs tuning fields after basic voice works */
  includeElevenLabsTuning?: boolean;
  elevenLabsStability?: number | null;
  elevenLabsSimilarityBoost?: number | null;
  elevenLabsStyle?: number | null;
  elevenLabsSpeakerBoost?: boolean | null;
  elevenLabsModelCapabilities?: {
    can_use_style: boolean;
    can_use_speaker_boost: boolean;
  } | null;
};

/**
 * Build Assistants voice_settings.
 * - Ultra: Telnyx.Ultra.<uuid> + optional expressive_mode
 * - ElevenLabs: ElevenLabs.<model>.<voiceId> + api_key_ref (never expressive_mode)
 * - NaturalHD: existing Telnyx voices
 */
export function buildAssistantVoiceSettings(input: AssistantVoiceSettingsInput): {
  voice_settings: Record<string, unknown>;
  providerVoiceId: string;
  isUltra: boolean;
  isElevenLabs: boolean;
  expressiveMode: boolean;
  apiKeyRef: string | null;
} {
  const rawRef = String(input.voiceRef || "").trim();

  // ElevenLabs catalog / provider strings
  if (
    rawRef.startsWith("el:") ||
    isElevenLabsProviderVoice(rawRef) ||
    parseElevenLabsCatalogId(rawRef).ok
  ) {
    const built = buildElevenLabsVoiceSettings({
      voiceRef: rawRef,
      apiKeyRef: input.apiKeyRef,
      includeTuning: Boolean(input.includeElevenLabsTuning),
      stability: input.elevenLabsStability,
      similarityBoost: input.elevenLabsSimilarityBoost,
      style: input.elevenLabsStyle,
      useSpeakerBoost: input.elevenLabsSpeakerBoost,
      modelCapabilities: input.elevenLabsModelCapabilities,
    });
    // ElevenLabs uses `speed` (not voice_speed); only set when tuning is enabled.
    if (input.speed != null && Number.isFinite(input.speed) && input.includeElevenLabsTuning) {
      built.voice_settings.speed = input.speed;
    }
    return {
      voice_settings: built.voice_settings,
      providerVoiceId: built.providerVoiceId,
      isUltra: false,
      isElevenLabs: true,
      expressiveMode: false,
      apiKeyRef: built.apiKeyRef,
    };
  }

  const providerVoiceId = resolveProviderVoiceId(input.voiceRef);
  const isUltra = isUltraProviderVoice(providerVoiceId);
  if (isUltra) {
    const check = validateUltraProviderVoiceId(providerVoiceId);
    if (!check.ok) {
      throw new Error(check.error || "Invalid Ultra voice");
    }
  }
  // Ultra defaults expressive_mode on; callers can pass expressiveMode: false to disable.
  // Never force expressive_mode on Natural / NaturalHD / ElevenLabs.
  const expressiveMode = Boolean(
    isUltra && (input.expressiveMode == null ? true : input.expressiveMode),
  );
  const voice_settings: Record<string, unknown> = {
    voice: providerVoiceId,
    // Telnyx MERGES voice_settings — clear ElevenLabs leftovers when leaving EL.
    api_key_ref: null,
    similarity_boost: null,
    temperature: null,
    style: null,
    use_speaker_boost: false,
    language_boost: null,
  };
  if (input.speed != null && Number.isFinite(input.speed)) {
    voice_settings.voice_speed = input.speed;
  }
  if (isUltra) {
    voice_settings.expressive_mode = expressiveMode;
  } else {
    voice_settings.expressive_mode = false;
  }
  if (input.volume != null && Number.isFinite(input.volume)) {
    voice_settings.volume = input.volume;
  }
  return {
    voice_settings,
    providerVoiceId,
    isUltra,
    isElevenLabs: false,
    expressiveMode,
    apiKeyRef: null,
  };
}

/** Sanitize Telnyx error body for UI / logs (never includes API keys). */
export function sanitizeTelnyxVoiceError(err: unknown): {
  message: string;
  status: number | null;
  code: string | null;
  body: unknown;
} {
  if (err && typeof err === "object" && "status" in err && "body" in err) {
    const status = Number((err as { status: number }).status) || null;
    const body = (err as { body: unknown }).body;
    let code: string | null = null;
    let detail: string | null = null;
    if (body && typeof body === "object" && Array.isArray((body as { errors?: unknown }).errors)) {
      const first = (body as { errors: Array<Record<string, unknown>> }).errors[0];
      if (first) {
        code = first.code != null ? String(first.code) : null;
        detail =
          (first.detail != null ? String(first.detail) : null) ||
          (first.title != null ? String(first.title) : null);
      }
    }
    return {
      message: detail || (err instanceof Error ? err.message : "Telnyx voice update failed"),
      status,
      code,
      body,
    };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    status: null,
    code: null,
    body: null,
  };
}

export function logVoiceAssistantUpdate(meta: {
  assistantId: string;
  requestedVoice: string;
  expressiveMode: boolean;
  status: number | string;
  errorBody?: unknown;
}) {
  console.info(
    "[telnyx-voice]",
    JSON.stringify({
      assistantId: meta.assistantId,
      requestedVoice: meta.requestedVoice,
      expressiveMode: meta.expressiveMode,
      status: meta.status,
      errorBody: meta.errorBody ?? null,
      // never log API keys
    }),
  );
}

/** UI-facing option shape used by VoicePicker + /api/voice/voices */
export type TelnyxVoiceOption = {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  tier: "ultra" | "natural_hd" | "natural" | "xai" | "elevenlabs";
  uiTier: VoiceUiTier;
  uiTierLabel: string;
  language: string;
  description: string;
  providerVoiceId: string;
  supportsSpeed: boolean;
  supportsExpressive: boolean;
  previewOnly?: boolean;
  assistantCompatible?: boolean;
  /** ElevenLabs-only metadata */
  elevenLabsModelId?: string;
  elevenLabsVoiceId?: string;
  previewUrl?: string | null;
  compatibility?: "available" | "telnyx_accepted" | "telnyx_rejected" | "not_on_account";
};

export const CURATED_TELNYX_VOICES: TelnyxVoiceOption[] = CURATED_VOICE_CATALOG.filter(
  (v) => v.enabled,
).map((v) => ({
  id: v.catalogId,
  name: v.displayName,
  gender: v.gender,
  tier:
    v.model === "Ultra"
      ? "ultra"
      : v.model === "xAI"
        ? "xai"
        : v.model === "NaturalHD"
          ? "natural_hd"
          : "natural",
  uiTier: v.uiTier,
  uiTierLabel: v.uiTier === "ultra" ? "Ultra Voice" : "Standard Voice",
  language: v.locale,
  description: v.previewOnly
    ? `${v.style} (preview compare — may not save to AI Assistants)`
    : v.style,
  providerVoiceId: v.providerVoiceId,
  supportsSpeed: v.supportsSpeed,
  supportsExpressive: v.supportsExpressive,
  previewOnly: v.previewOnly,
  assistantCompatible: v.assistantCompatible !== false && !v.previewOnly,
}));

export const DEFAULT_AGENT_VOICE_ID = DEFAULT_CATALOG_VOICE_ID;
