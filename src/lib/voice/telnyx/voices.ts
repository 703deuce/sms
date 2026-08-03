/**
 * Telnyx AI Assistant voice catalog + voice_settings helpers.
 *
 * Ultra format: Telnyx.Ultra.<voice_id>
 * Standard (Natural / NaturalHD) remains the safe default / fallback.
 *
 * History: Ultra was previously remapped to NaturalHD after Assistants returned
 * "Voice not found". That remap made the UI lie about the live voice. We now
 * send Ultra as selected, surface Telnyx errors, and keep NaturalHD as fallback.
 */

export type VoiceQualityTier = "premium" | "standard" | "economy";
export type VoiceCostTier = "standard" | "low" | "premium_provider";
export type VoiceUiTier = "standard" | "ultra";

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
 * Documented Telnyx Ultra sample voices (TTS + Assistants Voice Settings).
 * Do not invent IDs — only use values Telnyx publishes / returns.
 * @see https://developers.telnyx.com/docs/voice/tts/providers/telnyx/ultra
 */
export const DOCUMENTED_ULTRA_VOICE_IDS = [
  "Telnyx.Ultra.Clara",
  "Telnyx.Ultra.Callie",
  "Telnyx.Ultra.Asher",
] as const;

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
  // Ultra — same Voice AI minute rate as NaturalHD inside Assistants.
  {
    catalogId: "clara-ultra",
    displayName: "Clara",
    style: "Expressive Ultra — warm US English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Clara",
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
    style: "Expressive Ultra — clear English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Callie",
    model: "Ultra",
    language: "en",
    locale: "en",
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
    style: "Expressive Ultra — confident male English",
    provider: "telnyx",
    providerVoiceId: "Telnyx.Ultra.Asher",
    model: "Ultra",
    language: "en",
    locale: "en",
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
      error: "Ultra voice requires a voice_id after Telnyx.Ultra. (e.g. Telnyx.Ultra.Clara)",
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
  return raw.split(".").pop() || raw;
}

export function voiceUiTierLabel(catalogOrProviderId: string | undefined | null) {
  const v = getCuratedVoice(catalogOrProviderId);
  if (v?.uiTier === "ultra" || isUltraVoice(catalogOrProviderId)) return "Ultra Voice";
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
    id.startsWith("xAI.")
  );
}

export type AssistantVoiceSettingsInput = {
  /** Catalog id or provider voice string */
  voiceRef: string | undefined | null;
  speed?: number | null;
  expressiveMode?: boolean | null;
  volume?: number | null;
};

/**
 * Build Assistants voice_settings. Never forces expressive_mode on non-Ultra.
 */
export function buildAssistantVoiceSettings(input: AssistantVoiceSettingsInput): {
  voice_settings: Record<string, unknown>;
  providerVoiceId: string;
  isUltra: boolean;
  expressiveMode: boolean;
} {
  const providerVoiceId = resolveProviderVoiceId(input.voiceRef);
  const isUltra = isUltraProviderVoice(providerVoiceId);
  if (isUltra) {
    const check = validateUltraProviderVoiceId(providerVoiceId);
    if (!check.ok) {
      throw new Error(check.error || "Invalid Ultra voice");
    }
  }
  const expressiveMode = Boolean(isUltra && input.expressiveMode);
  const voice_settings: Record<string, unknown> = {
    voice: providerVoiceId,
  };
  if (input.speed != null && Number.isFinite(input.speed)) {
    voice_settings.voice_speed = input.speed;
  }
  if (expressiveMode) {
    voice_settings.expressive_mode = true;
  }
  if (input.volume != null && Number.isFinite(input.volume)) {
    voice_settings.volume = input.volume;
  }
  return { voice_settings, providerVoiceId, isUltra, expressiveMode };
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
  tier: "ultra" | "natural_hd" | "natural" | "xai";
  uiTier: VoiceUiTier;
  uiTierLabel: "Standard Voice" | "Ultra Voice";
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
