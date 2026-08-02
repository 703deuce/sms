/**
 * Curated Telnyx AI Assistant voice catalog.
 * Customer-facing labels are friendly; provider voice strings stay internal.
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
  model: "Ultra" | "NaturalHD" | "Natural";
  language: string;
  locale: string;
  gender: "female" | "male" | "neutral";
  qualityTier: VoiceQualityTier;
  costTier: VoiceCostTier;
  supportsSpeed: boolean;
  supportsExpressive: boolean;
  enabled: boolean;
  previewText: string;
};

export const DEFAULT_VOICE_PREVIEW_TEXT =
  "Hi, thanks for calling Transovo. I can answer questions, take a message, or help connect you with the right person.";

/**
 * ~12 strong voices — Ultra preferred, then NaturalHD.
 * Never default to Kokoro/basic browser TTS.
 */
export const CURATED_VOICE_CATALOG: CuratedVoice[] = [
  {
    catalogId: "ava-warm-us",
    displayName: "Ava",
    style: "Warm, professional US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Clara",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "maya-energetic-us",
    displayName: "Maya",
    style: "Clear, energetic US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Callie",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "female",
    qualityTier: "premium",
    costTier: "standard",
    supportsSpeed: true,
    supportsExpressive: true,
    enabled: true,
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "marcus-confident-us",
    displayName: "Marcus",
    style: "Confident, conversational US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Asher",
    model: "Ultra",
    language: "en",
    locale: "en-US",
    gender: "male",
    qualityTier: "premium",
    costTier: "standard",
    supportsSpeed: true,
    supportsExpressive: true,
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
    catalogId: "luna-bright-us",
    displayName: "Luna",
    style: "Bright assistant tone, US English",
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
    catalogId: "astra-clear-us",
    displayName: "Astra",
    style: "Clear, polished US English",
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
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  },
  {
    catalogId: "noah-calm-us",
    displayName: "Noah",
    style: "Calm, steady US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.NaturalHD.orion",
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
    catalogId: "james-polished-us",
    displayName: "James",
    style: "Calm, polished US English",
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
    previewText:
      "Bonjour, merci d'appeler Transovo. Je peux répondre à vos questions ou prendre un message.",
  },
];

/** Production default — Telnyx Ultra Clara (catalog: Ava). */
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

export function resolveProviderVoiceId(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v) return v.providerVoiceId;
  // Allow known Telnyx prefixes only — never silent cheap fallbacks.
  const raw = String(catalogOrProviderId || "");
  if (
    raw.startsWith("Telnyx.Ultra.") ||
    raw.startsWith("Telnyx.NaturalHD.") ||
    raw.startsWith("Telnyx.Natural.")
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
  return raw.split(".").pop() || raw;
}

export function isApprovedVoiceId(id: string) {
  if (CURATED_VOICE_CATALOG.some((v) => v.catalogId === id || v.providerVoiceId === id)) {
    return true;
  }
  return (
    id.startsWith("Telnyx.Ultra.") ||
    id.startsWith("Telnyx.NaturalHD.") ||
    id.startsWith("Telnyx.Natural.")
  );
}

/** UI-facing option shape used by VoicePicker + /api/voice/voices */
export type TelnyxVoiceOption = {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  tier: "ultra" | "natural_hd" | "natural";
  language: string;
  description: string;
  providerVoiceId: string;
  supportsSpeed: boolean;
  supportsExpressive: boolean;
};

export const CURATED_TELNYX_VOICES: TelnyxVoiceOption[] = CURATED_VOICE_CATALOG.filter(
  (v) => v.enabled,
).map((v) => ({
  id: v.catalogId,
  name: v.displayName,
  gender: v.gender,
  tier: v.model === "Ultra" ? "ultra" : v.model === "NaturalHD" ? "natural_hd" : "natural",
  language: v.locale,
  description: v.style,
  providerVoiceId: v.providerVoiceId,
  supportsSpeed: v.supportsSpeed,
  supportsExpressive: v.supportsExpressive,
}));

export const DEFAULT_AGENT_VOICE_ID = DEFAULT_CATALOG_VOICE_ID;
