/**
 * Curated Telnyx AI Assistant voice catalog.
 * Customer-facing labels are friendly; provider voice strings stay internal.
 *
 * Note: Telnyx Ultra voices are REST/TTS-oriented and are rejected by the
 * AI Assistants voice_settings API on this account ("Voice not found").
 * Curated defaults use NaturalHD voices that assistants actually accept.
 */

export type VoiceQualityTier = "premium" | "standard" | "economy";
export type VoiceCostTier = "standard" | "low" | "premium_provider";

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
  supportsSpeed: boolean;
  supportsExpressive: boolean;
  enabled: boolean;
  /** False when AI Assistants API historically rejects this voice id. */
  assistantCompatible?: boolean;
  /** Preview via TTS REST may still work when assistantCompatible is false. */
  previewOnly?: boolean;
  previewText: string;
};

export const DEFAULT_VOICE_PREVIEW_TEXT =
  "Hi, thanks for calling Transovo. I can answer questions, take a message, or help connect you with the right person.";

/**
 * Strong NaturalHD voices validated against Telnyx AI Assistants update API.
 */
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
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
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
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
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
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
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
    supportsSpeed: true,
    supportsExpressive: false,
    enabled: true,
    assistantCompatible: true,
    previewText:
      "Bonjour, merci d'appeler Transovo. Je peux répondre à vos questions ou prendre un message.",
  },
  // Ultra / expressive — excellent for TTS preview comparison. Some accounts
  // reject Ultra on AI Assistants voice_settings; keep preview-first until verified.
  {
    catalogId: "nova-ultra-preview",
    displayName: "Nova (Ultra preview)",
    style: "Premium expressive Ultra — preview & compare clarity",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Nova",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "premium_provider",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: false,
    previewOnly: true,
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
    supportsSpeed: false,
    supportsExpressive: true,
    enabled: true,
    assistantCompatible: false,
    previewOnly: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
];

/** Production default — NaturalHD Astra (catalog: Ava). */
export const DEFAULT_CATALOG_VOICE_ID = "ava-warm-us";

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
 * Voice id for AI Assistants / live calls.
 * Preview-only Ultra/xAI catalog entries map to NaturalHD so saves never break.
 */
export function resolveProviderVoiceId(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) {
    if (v.previewOnly || v.assistantCompatible === false) {
      return getCuratedVoice(DEFAULT_CATALOG_VOICE_ID)!.providerVoiceId;
    }
    return v.providerVoiceId;
  }
  const raw = String(catalogOrProviderId || "");
  // Legacy Ultra / xAI ids are not accepted by AI Assistants on this account — map to NaturalHD.
  if (raw.startsWith("Telnyx.Ultra.") || raw.startsWith("xAI.")) {
    return getCuratedVoice(DEFAULT_CATALOG_VOICE_ID)!.providerVoiceId;
  }
  if (raw.startsWith("Telnyx.NaturalHD.") || raw.startsWith("Telnyx.Natural.")) {
    return raw;
  }
  return getCuratedVoice(DEFAULT_CATALOG_VOICE_ID)!.providerVoiceId;
}

/**
 * Voice id for TTS preview clips — keeps Ultra/xAI so quality compare is real.
 */
export function resolvePreviewVoiceId(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) return v.providerVoiceId;
  const raw = String(catalogOrProviderId || "");
  if (
    raw.startsWith("Telnyx.NaturalHD.") ||
    raw.startsWith("Telnyx.Natural.") ||
    raw.startsWith("Telnyx.Ultra.") ||
    raw.startsWith("xAI.")
  ) {
    return raw;
  }
  return getCuratedVoice(DEFAULT_CATALOG_VOICE_ID)!.providerVoiceId;
}

export function isUltraVoice(voiceId: string) {
  return resolveProviderVoiceId(voiceId).startsWith("Telnyx.Ultra.");
}

export function voiceLabel(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) return `${v.displayName} — ${v.style}`;
  const raw = String(catalogOrProviderId || "");
  if (!raw) return "Ava — Warm, professional US English";
  // Map legacy Ultra labels to Ava so the UI never advertises a rejected voice.
  if (raw.startsWith("Telnyx.Ultra.")) {
    return "Ava — Warm, professional US English";
  }
  return raw.split(".").pop() || raw;
}

export function isApprovedVoiceId(id: string) {
  if (CURATED_VOICE_CATALOG.some((v) => v.catalogId === id || v.providerVoiceId === id)) {
    return true;
  }
  return (
    id.startsWith("Telnyx.NaturalHD.") ||
    id.startsWith("Telnyx.Natural.") ||
    id.startsWith("Telnyx.Ultra.") ||
    id.startsWith("xAI.")
  );
}

/** UI-facing option shape used by VoicePicker + /api/voice/voices */
export type TelnyxVoiceOption = {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  tier: "ultra" | "natural_hd" | "natural" | "xai";
  language: string;
  description: string;
  providerVoiceId: string;
  supportsSpeed: boolean;
  supportsExpressive: boolean;
  previewOnly?: boolean;
  assistantCompatible?: boolean;
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
