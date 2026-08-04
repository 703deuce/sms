/**
 * Telnyx managed-assistant latency A/B profiles.
 *
 * VERSION A — current baseline (preserve / rollback)
 * VERSION B — Flux + eager EOT + 0.1s start plan + fast LLM + Ultra
 * VERSION C — native-audio Ultravox experiment (no STT settings)
 *
 * Do not auto-migrate production agents. Opt-in apply + rollback snapshot only.
 * Do not invent provider-internal timestamps or a second media pipeline.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export const LATENCY_PROFILE_IDS = [
  "legacy_cascade",
  "flux_eager_low_latency",
  "native_audio_ultravox",
] as const;

export type LatencyProfileId = (typeof LATENCY_PROFILE_IDS)[number];

/** Aliases matching the test-matrix naming. */
export const VERSION_A_BASELINE: LatencyProfileId = "legacy_cascade";
export const VERSION_B_LATENCY_OPTIMIZED: LatencyProfileId = "flux_eager_low_latency";
export const VERSION_C_NATIVE_AUDIO: LatencyProfileId = "native_audio_ultravox";

export const ACTIVE_LATENCY_PROFILE_DEFAULT: LatencyProfileId = "legacy_cascade";

/** Fast LLM for ordinary receptionist turns (Telnyx docs / Haiku-class). */
export const FAST_LLM_MODEL_ID = "anthropic/claude-haiku-4-5";

/** Native-audio experiment model (Telnyx-supported). */
export const NATIVE_AUDIO_MODEL_ID = "fixie-ai/ultravox-v0_4";

/**
 * Reporting bands for ordinary non-tool turns (not artificial delays).
 * Primary goal: p50 under 500 ms. Do not claim success without phone measurements.
 */
export const ORDINARY_TURN_LATENCY_BANDS = {
  primaryGoalMs: 500,
  strongResultMs: 450,
  warningMs: 700,
  investigateMs: 1000,
} as const;

export type StartSpeakingPlanConfig = {
  waitSeconds: number;
  onPunctuationSeconds: number;
  onNoPunctuationSeconds: number;
  onNumberSeconds: number;
};

export type LatencyProfileProviderFields = {
  transcription: {
    enabled?: boolean;
    sttProvider?: string;
    sttModel?: string;
    language?: string;
    keyterms?: string[];
    settings?: Record<string, unknown>;
  };
  voiceLanguage: {
    endpointingMs?: number;
    silenceTimeoutMs?: number;
    bargeIn?: boolean;
    /** Prefer Ultra for Version B when switching from NaturalHD. */
    preferUltra?: boolean;
  };
  model?: {
    modelId?: string;
  };
  startSpeakingPlan?: StartSpeakingPlanConfig;
  /** Native-audio models ignore normal transcription config. */
  nativeAudio?: boolean;
  greetingMode?: "fixed" | "preserve";
};

export type LatencyProfileRollbackSnapshot = {
  capturedAt: string;
  fromProfile: LatencyProfileId | "custom" | null;
  fields: LatencyProfileProviderFields & {
    voiceId?: string;
    speed?: number;
    greeting?: string;
    modelId?: string;
  };
};

export type LatencyProfileDefinition = {
  id: LatencyProfileId;
  versionLabel: "A" | "B" | "C";
  label: string;
  description: string;
  fields: LatencyProfileProviderFields;
};

export const LEGACY_CASCADE_PROFILE: LatencyProfileDefinition = {
  id: "legacy_cascade",
  versionLabel: "A",
  label: "Version A — current baseline",
  description:
    "Preserve current agent STT/LLM/TTS/endpointing. Used as control and rollback target.",
  fields: {
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/nova-3",
      language: "en",
      settings: undefined,
    },
    voiceLanguage: {
      endpointingMs: 300,
      silenceTimeoutMs: 2500,
      bargeIn: true,
      preferUltra: false,
    },
    startSpeakingPlan: {
      waitSeconds: 0.3,
      onPunctuationSeconds: 0.1,
      onNoPunctuationSeconds: 1.5,
      onNumberSeconds: 1.0,
    },
    greetingMode: "preserve",
    nativeAudio: false,
  },
};

/**
 * Version B — Telnyx-documented Flux defaults + low start-speaking plan.
 * eot_timeout_ms 5000 is the force-end fallback, not desired conversational delay.
 */
export const FLUX_EAGER_LOW_LATENCY_PROFILE: LatencyProfileDefinition = {
  id: "flux_eager_low_latency",
  versionLabel: "B",
  label: "Version B — latency optimized cascade",
  description:
    "Deepgram Flux eager EOT (0.8/0.4/5000), wait 0.1s + endpointing plan, fast Haiku-class LLM, prefer Ultra TTS, fixed greeting.",
  fields: {
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/flux",
      language: "en",
      settings: {
        eot_threshold: 0.8,
        eager_eot_threshold: 0.4,
        eot_timeout_ms: 5000,
      },
    },
    voiceLanguage: {
      endpointingMs: 100,
      silenceTimeoutMs: 2500,
      bargeIn: true,
      preferUltra: true,
    },
    model: {
      modelId: FAST_LLM_MODEL_ID,
    },
    startSpeakingPlan: {
      waitSeconds: 0.1,
      onPunctuationSeconds: 0.1,
      // Begin test at 1.0s (Telnyx customer-service default is 1.5; we test slightly faster).
      onNoPunctuationSeconds: 1.0,
      onNumberSeconds: 1.0,
    },
    greetingMode: "fixed",
    nativeAudio: false,
  },
};

export const NATIVE_AUDIO_ULTRAVOX_PROFILE: LatencyProfileDefinition = {
  id: "native_audio_ultravox",
  versionLabel: "C",
  label: "Version C — native audio Ultravox",
  description:
    "Telnyx native-audio model fixie-ai/ultravox-v0_4. Transcription settings are ignored by Telnyx for native-audio models.",
  fields: {
    transcription: {
      // Telnyx ignores normal transcription config for native-audio models.
      enabled: false,
      sttModel: undefined,
      settings: undefined,
    },
    voiceLanguage: {
      endpointingMs: 100,
      silenceTimeoutMs: 2500,
      bargeIn: true,
      preferUltra: false,
    },
    model: {
      modelId: NATIVE_AUDIO_MODEL_ID,
    },
    startSpeakingPlan: {
      waitSeconds: 0.1,
      onPunctuationSeconds: 0.1,
      onNoPunctuationSeconds: 1.0,
      onNumberSeconds: 1.0,
    },
    greetingMode: "fixed",
    nativeAudio: true,
  },
};

export const LATENCY_PROFILES: Record<LatencyProfileId, LatencyProfileDefinition> =
  {
    legacy_cascade: LEGACY_CASCADE_PROFILE,
    flux_eager_low_latency: FLUX_EAGER_LOW_LATENCY_PROFILE,
    native_audio_ultravox: NATIVE_AUDIO_ULTRAVOX_PROFILE,
  };

/** Tools that must stay synchronous (caller needs the result). */
export const SYNC_TOOL_TYPES = new Set([
  "calendar_availability",
  "book_appointment",
  "lookup_customer",
  "search_crm_contacts",
  "escalate_human",
  "transfer",
  "hangup",
  "end_call",
  "send_dtmf",
]);

/** Tools that should run async (do not block spoken turn). */
export const ASYNC_TOOL_TYPES = new Set([
  "create_crm_note",
  "create_crm_task",
  "create_task",
  "mark_disposition",
  "save_caller_info",
  "update_contact_tags",
  "upsert_crm_contact",
  "send_sms",
]);

export const SYNC_TOOL_FILLERS: Record<string, string> = {
  calendar_availability: "Let me check.",
  book_appointment: "One moment while I book that.",
  lookup_customer: "One moment while I pull that up.",
  search_crm_contacts: "One moment while I pull that up.",
  escalate_human: "Sure, I'll connect you.",
};

export function isLatencyProfileId(value: unknown): value is LatencyProfileId {
  return (
    typeof value === "string" &&
    (LATENCY_PROFILE_IDS as readonly string[]).includes(value)
  );
}

export function getLatencyProfile(id?: string | null): LatencyProfileDefinition {
  if (isLatencyProfileId(id)) return LATENCY_PROFILES[id];
  return LATENCY_PROFILES[ACTIVE_LATENCY_PROFILE_DEFAULT];
}

export function isDeepgramFluxModel(model?: string | null): boolean {
  return String(model || "").toLowerCase() === "deepgram/flux";
}

export function isNativeAudioModel(model?: string | null): boolean {
  const m = String(model || "").toLowerCase();
  return m.includes("ultravox") || m.startsWith("fixie-ai/");
}

/** Version B or C — apply tool async/fillers and low-latency startup prefs. */
export function isLatencyOptimizedProfile(
  profileId?: string | null,
): boolean {
  return (
    profileId === VERSION_B_LATENCY_OPTIMIZED ||
    profileId === VERSION_C_NATIVE_AUDIO
  );
}

export function isFluxEagerLatencyProfile(
  profileId?: string | null,
): boolean {
  return profileId === VERSION_B_LATENCY_OPTIMIZED;
}

export function snapshotProviderLatencyFields(
  config: VoiceAgentConfig,
): LatencyProfileRollbackSnapshot["fields"] {
  const t = config.transcription || {};
  const v = config.voiceLanguage || {};
  return {
    transcription: {
      enabled: t.enabled,
      sttProvider: t.sttProvider,
      sttModel: t.sttModel,
      language: t.language,
      keyterms: t.keyterms ? [...t.keyterms] : undefined,
      settings: t.settings ? { ...t.settings } : undefined,
    },
    voiceLanguage: {
      endpointingMs: v.endpointingMs,
      silenceTimeoutMs: v.silenceTimeoutMs,
      bargeIn: v.bargeIn,
    },
    voiceId: v.voiceId,
    speed: v.speed,
    modelId: config.model?.modelId,
    greeting:
      typeof config.callHandling?.greeting === "string"
        ? config.callHandling.greeting
        : undefined,
  };
}

function currentProfileId(
  config: VoiceAgentConfig,
): LatencyProfileId | "custom" | null {
  const id = config.voiceTiming?.activeProfile;
  if (isLatencyProfileId(id)) return id;
  return null;
}

/**
 * Prefer keeping an existing Ultra voice; otherwise set Allie Ultra catalog id.
 * Does not force Ultra over an already-selected Ultra voice.
 */
export function resolveUltraVoiceId(currentVoiceId?: string | null): string {
  const raw = String(currentVoiceId || "");
  if (/ultra/i.test(raw) || raw.startsWith("Telnyx.Ultra.")) return raw;
  // Catalog id used elsewhere in Transovo for Ultra conversationalist.
  return "allie-ultra";
}

export function applyLatencyProfileToConfig(
  config: VoiceAgentConfig,
  profileId: LatencyProfileId,
  opts?: { preserveExistingRollback?: boolean },
): VoiceAgentConfig {
  const profile = getLatencyProfile(profileId);
  const existingRollback = config.voiceTiming?.rollbackSnapshot as
    | LatencyProfileRollbackSnapshot
    | undefined;

  const rollbackSnapshot: LatencyProfileRollbackSnapshot =
    opts?.preserveExistingRollback && existingRollback?.fields
      ? existingRollback
      : {
          capturedAt: new Date().toISOString(),
          fromProfile: currentProfileId(config),
          fields: snapshotProviderLatencyFields(config),
        };

  const keyterms =
    config.transcription?.keyterms?.length
      ? config.transcription.keyterms
      : profile.fields.transcription.keyterms;

  const nextVoiceId = profile.fields.voiceLanguage.preferUltra
    ? resolveUltraVoiceId(config.voiceLanguage?.voiceId)
    : config.voiceLanguage?.voiceId;

  const greeting =
    profile.fields.greetingMode === "fixed"
      ? String(
          config.callHandling?.greeting ||
            "Thanks for calling. How can I help you today?",
        )
      : config.callHandling?.greeting;

  const next: VoiceAgentConfig = {
    ...config,
    transcription: profile.fields.nativeAudio
      ? {
          ...config.transcription,
          enabled: false,
          sttModel: undefined,
          settings: undefined,
        }
      : {
          ...config.transcription,
          enabled: profile.fields.transcription.enabled ?? true,
          sttProvider: profile.fields.transcription.sttProvider,
          sttModel: profile.fields.transcription.sttModel,
          language:
            config.transcription?.language ||
            profile.fields.transcription.language ||
            "en",
          keyterms,
          settings: profile.fields.transcription.settings
            ? { ...profile.fields.transcription.settings }
            : undefined,
        },
    voiceLanguage: {
      ...config.voiceLanguage,
      voiceId: nextVoiceId,
      endpointingMs: profile.fields.voiceLanguage.endpointingMs,
      silenceTimeoutMs:
        profile.fields.voiceLanguage.silenceTimeoutMs ??
        config.voiceLanguage?.silenceTimeoutMs ??
        2500,
      bargeIn:
        profile.fields.voiceLanguage.bargeIn ??
        config.voiceLanguage?.bargeIn !== false,
    },
    model: {
      ...config.model,
      ...(profile.fields.model?.modelId
        ? { modelId: profile.fields.model.modelId }
        : {}),
    },
    callHandling: {
      ...(config.callHandling || {}),
      ...(greeting != null ? { greeting } : {}),
    },
    voiceTiming: {
      ...(config.voiceTiming || {}),
      activeProfile: profileId,
      experimental: profileId !== "legacy_cascade",
      rollbackSnapshot: rollbackSnapshot as unknown as Record<string, unknown>,
      diagnostics: {
        ...(config.voiceTiming?.diagnostics || {}),
        versionLabel: profile.versionLabel,
        ordinaryTurnPrimaryGoalMs: ORDINARY_TURN_LATENCY_BANDS.primaryGoalMs,
        metric: "caller_end_of_speech_to_first_audible_agent_audio",
        note: "Do not claim sub-500ms until real telephone measurements confirm it.",
        startSpeakingPlan: profile.fields.startSpeakingPlan,
      },
    },
  };

  return next;
}

export function rollbackLatencyProfileConfig(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const snap = config.voiceTiming?.rollbackSnapshot as
    | LatencyProfileRollbackSnapshot
    | undefined;
  if (!snap?.fields) {
    return applyLatencyProfileToConfig(config, "legacy_cascade", {
      preserveExistingRollback: true,
    });
  }

  const f = snap.fields;
  return {
    ...config,
    transcription: {
      ...config.transcription,
      ...f.transcription,
      settings: f.transcription.settings
        ? { ...f.transcription.settings }
        : undefined,
    },
    voiceLanguage: {
      ...config.voiceLanguage,
      ...f.voiceLanguage,
      ...(f.voiceId ? { voiceId: f.voiceId } : {}),
      ...(f.speed != null ? { speed: f.speed } : {}),
    },
    model: {
      ...config.model,
      ...(f.modelId ? { modelId: f.modelId } : {}),
    },
    callHandling: {
      ...(config.callHandling || {}),
      ...(f.greeting != null ? { greeting: f.greeting } : {}),
    },
    voiceTiming: {
      ...(config.voiceTiming || {}),
      activeProfile: isLatencyProfileId(snap.fromProfile)
        ? snap.fromProfile
        : "legacy_cascade",
      experimental: false,
      rollbackSnapshot: snap as unknown as Record<string, unknown>,
      diagnostics: {
        ...(config.voiceTiming?.diagnostics || {}),
        rolledBackAt: new Date().toISOString(),
      },
    },
  };
}

/** Telnyx Flux transcription.settings (only when model is deepgram/flux). */
export function buildFluxTranscriptionSettings(
  config: VoiceAgentConfig,
): Record<string, unknown> | undefined {
  const model =
    config.transcription?.sttModel?.trim() ||
    process.env.VOICE_TRANSCRIPTION_MODEL?.trim() ||
    "";
  if (!isDeepgramFluxModel(model)) return undefined;
  if (isNativeAudioModel(config.model?.modelId)) return undefined;

  const explicit = config.transcription?.settings || {};
  const settings: Record<string, unknown> = {
    eot_threshold:
      typeof explicit.eot_threshold === "number" ? explicit.eot_threshold : 0.8,
    eager_eot_threshold:
      typeof explicit.eager_eot_threshold === "number"
        ? explicit.eager_eot_threshold
        : 0.4,
    eot_timeout_ms:
      typeof explicit.eot_timeout_ms === "number"
        ? explicit.eot_timeout_ms
        : 5000,
  };
  if (typeof explicit.keyterm === "string" && explicit.keyterm.trim()) {
    settings.keyterm = explicit.keyterm.trim();
  } else if (config.transcription?.keyterms?.length) {
    settings.keyterm = config.transcription.keyterms.join(",");
  }
  return settings;
}

/**
 * Build Telnyx interruption_settings.start_speaking_plan from profile/config.
 * Includes transcription_endpointing_plan (Telnyx-supported).
 */
export function buildStartSpeakingPlanFromConfig(
  config: VoiceAgentConfig,
): Record<string, unknown> {
  const diagnosticsPlan = (
    config.voiceTiming?.diagnostics as
      | { startSpeakingPlan?: StartSpeakingPlanConfig }
      | undefined
  )?.startSpeakingPlan;

  const profile = isLatencyProfileId(config.voiceTiming?.activeProfile)
    ? getLatencyProfile(config.voiceTiming?.activeProfile)
    : null;

  const plan =
    diagnosticsPlan ||
    profile?.fields.startSpeakingPlan ||
    (isDeepgramFluxModel(config.transcription?.sttModel)
      ? FLUX_EAGER_LOW_LATENCY_PROFILE.fields.startSpeakingPlan!
      : LEGACY_CASCADE_PROFILE.fields.startSpeakingPlan!);

  // Prefer explicit endpointingMs when set (maps to wait_seconds).
  const waitFromEndpointing =
    config.voiceLanguage?.endpointingMs != null
      ? config.voiceLanguage.endpointingMs / 1000
      : plan.waitSeconds;

  const waitSeconds = Math.max(
    0.1,
    Math.min(1.5, waitFromEndpointing ?? plan.waitSeconds),
  );

  return {
    wait_seconds: waitSeconds,
    transcription_endpointing_plan: {
      on_punctuation_seconds: plan.onPunctuationSeconds,
      on_no_punctuation_seconds: plan.onNoPunctuationSeconds,
      on_number_seconds: plan.onNumberSeconds,
    },
  };
}

export const LOW_LATENCY_CONVERSATION_GUIDANCE = [
  "LOW-LATENCY CONVERSATION:",
  "- Lead with the answer in the first short clause.",
  "- One question per turn; one or two short sentences.",
  "- For appointment choices, offer two options first.",
  "- Do not narrate tools, APIs, or internal reasoning.",
  "- Only before a real external wait, Telnyx may play a short scripted filler — do not invent extra fillers on ordinary turns.",
  "- Stop speaking as soon as the caller has enough information.",
].join("\n");
