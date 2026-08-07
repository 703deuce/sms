/**
 * Telnyx managed-assistant latency A/B profiles.
 *
 * VERSION A — current baseline (preserve / rollback)
 * VERSION B — Flux + eager EOT + 0.1s start plan + fast LLM + Ultra
 * VERSION C — native-audio Ultravox experiment (no STT settings)
 *
 * Do not auto-migrate production agents. Opt-in apply + rollback snapshot only.
 * Do not invent provider-internal timestamps or a second media pipeline.
 *
 * Product default for NEW agents: flux_b_balanced (Flux + Haiku + Ultra,
 * skip dynvar webhook, async tools + fillers). legacy_cascade remains available
 * as an explicit opt-in rollback profile — it is no longer the create default.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export const LATENCY_PROFILE_IDS = [
  "legacy_cascade",
  "flux_eager_low_latency", // alias: B_BALANCED (backward compatible)
  "flux_b_fast",
  "flux_b_balanced",
  "flux_b_patient",
  "native_audio_ultravox",
] as const;

export type LatencyProfileId = (typeof LATENCY_PROFILE_IDS)[number];

/** Aliases matching the test-matrix naming. */
export const VERSION_A_BASELINE: LatencyProfileId = "legacy_cascade";
export const VERSION_B_LATENCY_OPTIMIZED: LatencyProfileId = "flux_eager_low_latency";
export const VERSION_B_FAST: LatencyProfileId = "flux_b_fast";
export const VERSION_B_BALANCED: LatencyProfileId = "flux_b_balanced";
export const VERSION_B_PATIENT: LatencyProfileId = "flux_b_patient";
export const VERSION_C_NATIVE_AUDIO: LatencyProfileId = "native_audio_ultravox";

export const ACTIVE_LATENCY_PROFILE_DEFAULT: LatencyProfileId = "flux_b_balanced";

/** Fast LLM for ordinary receptionist turns (Telnyx docs / Haiku-class). */
export const FAST_LLM_MODEL_ID = "anthropic/claude-haiku-4-5";

/** Native-audio experiment model (Telnyx Inference audio-language model ID). */
export const NATIVE_AUDIO_MODEL_ID = "fixie-ai/ultravox-v0_4_1-llama-3_1-8b";

/** Candidate IDs to probe if the primary Ultravox model is rejected. */
export const NATIVE_AUDIO_MODEL_CANDIDATES = [
  "fixie-ai/ultravox-v0_4_1-llama-3_1-8b",
  "Fixie-ai/ultravox-v0_4_1-llama-3_1-8b",
  "fixie-ai/ultravox-v0_4",
  "Fixie-ai/ultravox-v0_4",
] as const;

/**
 * Reporting bands for ordinary non-tool turns (not artificial delays).
 * Primary goal: p50 under 500 ms. Do not claim success without phone measurements.
 */
export const ORDINARY_TURN_LATENCY_BANDS = {
  primaryGoalMs: 500,
  p75GoalMs: 650,
  p95GoalMs: 900,
  strongResultMs: 450,
  warningMs: 700,
  investigateMs: 1000,
} as const;

export type StartSpeakingPlanConfig = {
  waitSeconds: number;
  onPunctuationSeconds?: number;
  onNoPunctuationSeconds?: number;
  onNumberSeconds?: number;
  /**
   * When true (Flux), only wait_seconds is sent to Telnyx.
   * Telnyx docs: transcription_endpointing_plan applies to non turn-taking
   * models; Flux uses transcription.settings EOT instead.
   */
  fluxOmitTranscriptionEndpointingPlan?: boolean;
};

/** Provenance of a field in the live Telnyx assistant request. */
export type TelnyxFieldStatus =
  | "sent_and_applicable"
  | "sent_may_be_ignored"
  | "not_sent"
  | "ignored_by_native_audio_model"
  | "local_ui_only"
  | "unknown_requires_call_trace";

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
    /**
     * Transovo local field. For cascade assistants it maps ONLY to
     * interruption_settings.start_speaking_plan.wait_seconds (ms → s).
     * It is NOT a separate Telnyx "endpointing" API field.
     * Omit (undefined) for native-audio profiles that do not send wait_seconds.
     */
    endpointingMs?: number;
    silenceTimeoutMs?: number;
    bargeIn?: boolean;
    /** Prefer Ultra for Version B when switching from NaturalHD. */
    preferUltra?: boolean;
  };
  model?: {
    modelId?: string;
  };
  startSpeakingPlan?: StartSpeakingPlanConfig | null;
  /** Native-audio models ignore normal transcription config. */
  nativeAudio?: boolean;
  greetingMode?: "fixed" | "preserve";
  /**
   * When true, publish clears dynamic_variables_webhook_url so startup
   * webhook latency cannot contaminate first-turn benchmarks.
   */
  skipDynamicVariablesWebhook?: boolean;
  /** Documented Telnyx field applicability for this profile. */
  telnyxFieldPlan?: Record<string, TelnyxFieldStatus>;
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
    skipDynamicVariablesWebhook: false,
    telnyxFieldPlan: {
      transcription_model: "sent_and_applicable",
      start_speaking_wait_seconds: "sent_and_applicable",
      transcription_endpointing_plan: "sent_and_applicable",
      voice_settings: "sent_and_applicable",
      endpointingMs_local: "local_ui_only",
    },
  },
};

/**
 * Shared Flux cascade fields for Version B variants.
 * Turn-taking is Flux EOT only — no punctuation/number endpointing plan,
 * no local "endpointingMs" third layer.
 */
function buildFluxCascadeFields(input: {
  eotThreshold: number;
  eagerEotThreshold: number;
}): LatencyProfileProviderFields {
  return {
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/flux",
      language: "en",
      settings: {
        eot_threshold: input.eotThreshold,
        eager_eot_threshold: input.eagerEotThreshold,
        eot_timeout_ms: 5000,
      },
    },
    voiceLanguage: {
      // Do not set endpointingMs — that was a confusing local alias, not Telnyx.
      silenceTimeoutMs: 2500,
      bargeIn: true,
      preferUltra: true,
    },
    model: {
      modelId: FAST_LLM_MODEL_ID,
    },
    // Telnyx: Flux EOT drives turn end. Clear legacy punctuation waits.
    // Optional wait_seconds 0.1 is Telnyx's recommended Flux companion floor,
    // not a universal 1s no-punct delay.
    startSpeakingPlan: {
      waitSeconds: 0.1,
      fluxOmitTranscriptionEndpointingPlan: true,
    },
    greetingMode: "fixed",
    nativeAudio: false,
    // Skip call-start dynvar webhook so greeting is not blocked. Fresh clock
    // comes from the resolve_datetime tool mid-call when relative times matter.
    skipDynamicVariablesWebhook: true,
    telnyxFieldPlan: {
      transcription_model_deepgram_flux: "sent_and_applicable",
      eot_threshold: "sent_and_applicable",
      eager_eot_threshold: "sent_and_applicable",
      eot_timeout_ms: "sent_and_applicable",
      start_speaking_wait_seconds: "sent_and_applicable",
      on_punctuation_seconds: "not_sent",
      on_no_punctuation_seconds: "not_sent",
      on_number_seconds: "not_sent",
      endpointingMs_local: "not_sent",
      voice_settings_ultra: "sent_and_applicable",
      dynamic_variables_webhook: "not_sent",
    },
  };
}

/**
 * B_BALANCED — Telnyx-documented Flux defaults (0.80 / 0.40).
 * Production candidate. Also registered as flux_eager_low_latency for compat.
 */
export const FLUX_B_BALANCED_PROFILE: LatencyProfileDefinition = {
  id: "flux_b_balanced",
  versionLabel: "B",
  label: "B-Balanced — Flux 0.80/0.40 + Haiku + Ultra",
  description:
    "Recommended production candidate. Deepgram Flux EOT 0.80/0.40/5000, Haiku, Ultra, fixed greeting. No punctuation/number waits.",
  fields: buildFluxCascadeFields({
    eotThreshold: 0.8,
    eagerEotThreshold: 0.4,
  }),
};

/** Backward-compatible id for B_BALANCED. */
export const FLUX_EAGER_LOW_LATENCY_PROFILE: LatencyProfileDefinition = {
  ...FLUX_B_BALANCED_PROFILE,
  id: "flux_eager_low_latency",
  label: "Version B — Flux + eager EOT + Haiku + Ultra (B-Balanced)",
};

/**
 * B_FAST — aggressive eager EOT (0.75 / 0.35). Test only; do not auto-promote.
 */
export const FLUX_B_FAST_PROFILE: LatencyProfileDefinition = {
  id: "flux_b_fast",
  versionLabel: "B",
  label: "B-Fast — Flux 0.75/0.35 + Haiku + Ultra",
  description:
    "Maximum-speed Flux test. EOT 0.75 / eager 0.35. Promote only if premature-response rate stays acceptable.",
  fields: buildFluxCascadeFields({
    eotThreshold: 0.75,
    eagerEotThreshold: 0.35,
  }),
};

/**
 * B_PATIENT — more conservative EOT (0.85 / 0.45) for long answers / intake.
 */
export const FLUX_B_PATIENT_PROFILE: LatencyProfileDefinition = {
  id: "flux_b_patient",
  versionLabel: "B",
  label: "B-Patient — Flux 0.85/0.45 + Haiku + Ultra",
  description:
    "Patient Flux variant for long answers and intake. EOT 0.85 / eager 0.45. Prefer a dedicated collection workflow for phone/address rather than slowing every turn.",
  fields: buildFluxCascadeFields({
    eotThreshold: 0.85,
    eagerEotThreshold: 0.45,
  }),
};

/**
 * Version C — Ultravox native-audio INPUT.
 *
 * Telnyx ignores transcription for fixie-ai/ultravox-v0_4_1-llama-3_1-8b.
 * Ultravox (Fixie/HF) generates text output; Telnyx assistants still expose a
 * selectable TTS voice — so Howard Ultra is the intended OUTGOING path
 * (native input → text → Ultra TTS), not "Ultravox speaks natively."
 * Confirm via live Telnyx payload + call audio that voice_settings is honored.
 *
 * Do not copy Flux punctuation endpointing timers into this profile.
 */
export const NATIVE_AUDIO_ULTRAVOX_PROFILE: LatencyProfileDefinition = {
  id: "native_audio_ultravox",
  versionLabel: "C",
  label: "Version C — Ultravox native-audio input + Ultra TTS",
  description:
    "Requires Telnyx account access to fixie-ai/ultravox-v0_4_1-llama-3_1-8b (native audio understanding). Fails with Telnyx 10027 if Ultravox is not enabled on the account. Transcription ignored when available. Outgoing audio expected via Ultra TTS.",
  fields: {
    transcription: {
      enabled: false,
      sttModel: undefined,
      settings: undefined,
    },
    voiceLanguage: {
      // Do not invent a third endpointing layer for Ultravox (omit wait alias).
      silenceTimeoutMs: 2500,
      bargeIn: true,
      preferUltra: true,
    },
    model: {
      modelId: NATIVE_AUDIO_MODEL_ID,
    },
    startSpeakingPlan: null,
    greetingMode: "fixed",
    nativeAudio: true,
    skipDynamicVariablesWebhook: true,
    telnyxFieldPlan: {
      transcription: "ignored_by_native_audio_model",
      eot_threshold: "not_sent",
      eager_eot_threshold: "not_sent",
      eot_timeout_ms: "not_sent",
      start_speaking_wait_seconds: "sent_may_be_ignored",
      on_punctuation_seconds: "not_sent",
      on_no_punctuation_seconds: "not_sent",
      on_number_seconds: "not_sent",
      endpointingMs_local: "not_sent",
      voice_settings_ultra:
        "sent_may_be_ignored", // sent; Ultravox→text then TTS expected — verify on call
      dynamic_variables_webhook: "not_sent",
      ultravox_outgoing_audio_path: "unknown_requires_call_trace",
      transcription_endpointing_plan_cleared: "sent_and_applicable",
    },
  },
};

export const LATENCY_PROFILES: Record<LatencyProfileId, LatencyProfileDefinition> =
  {
    legacy_cascade: LEGACY_CASCADE_PROFILE,
    flux_eager_low_latency: FLUX_EAGER_LOW_LATENCY_PROFILE,
    flux_b_fast: FLUX_B_FAST_PROFILE,
    flux_b_balanced: FLUX_B_BALANCED_PROFILE,
    flux_b_patient: FLUX_B_PATIENT_PROFILE,
    native_audio_ultravox: NATIVE_AUDIO_ULTRAVOX_PROFILE,
  };

/** Tools that must stay synchronous (caller needs the result). */
export const SYNC_TOOL_TYPES = new Set([
  "calendar_availability",
  "book_appointment",
  "continue_workflow",
  "resolve_datetime",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
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

/** Immediate request_start line for sync tools. */
export const SYNC_TOOL_FILLERS: Record<string, string> = {
  calendar_availability: "Okay, hold on — let me check that.",
  book_appointment: "Okay, hold on — let me book that.",
  continue_workflow: "Okay, hold on — let me check that.",
  resolve_datetime: "One moment.",
  find_appointments: "Okay, hold on — let me look that up.",
  reschedule_appointment: "Okay, hold on — let me move that.",
  cancel_appointment: "Okay, hold on — let me cancel that.",
  lookup_customer: "Okay, hold on — let me pull that up.",
  search_crm_contacts: "Okay, hold on — let me pull that up.",
  escalate_human: "Sure, I'll connect you.",
};

/**
 * Progressive Telnyx filler_messages for sync webhook tools.
 * request_start plays immediately; request_response_delayed only if still waiting.
 */
export function buildSyncToolFillerMessages(
  toolType: string,
): Array<{ type: string; content: string; timing_ms?: number }> | null {
  const start = SYNC_TOOL_FILLERS[toolType];
  if (!start) return null;
  // Short tools: start filler only.
  if (toolType === "resolve_datetime" || toolType === "escalate_human") {
    return [{ type: "request_start", content: start }];
  }
  return [
    { type: "request_start", content: start },
    {
      type: "request_response_delayed",
      content: "Alright, almost there.",
      timing_ms: 4000,
    },
    {
      type: "request_response_delayed",
      content: "Still working on it right now.",
      timing_ms: 10000,
    },
    {
      type: "request_response_delayed",
      content: "Thanks for waiting — still finishing that up.",
      timing_ms: 15000,
    },
    {
      type: "request_response_delayed",
      content: "Hang tight, I'm still on it.",
      timing_ms: 20000,
    },
  ];
}

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

/** Version B variants or C — apply tool async/fillers and low-latency startup prefs. */
export function isLatencyOptimizedProfile(
  profileId?: string | null,
): boolean {
  return (
    profileId === VERSION_B_LATENCY_OPTIMIZED ||
    profileId === VERSION_B_FAST ||
    profileId === VERSION_B_BALANCED ||
    profileId === VERSION_B_PATIENT ||
    profileId === VERSION_C_NATIVE_AUDIO
  );
}

export function isFluxEagerLatencyProfile(
  profileId?: string | null,
): boolean {
  return (
    profileId === VERSION_B_LATENCY_OPTIMIZED ||
    profileId === VERSION_B_FAST ||
    profileId === VERSION_B_BALANCED ||
    profileId === VERSION_B_PATIENT
  );
}

/** Resolve CLI / short aliases (B_FAST, B-Balanced, etc.) to profile ids. */
export function resolveLatencyProfileAlias(
  value?: string | null,
): LatencyProfileId | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (isLatencyProfileId(raw)) return raw;
  const key = raw.toUpperCase().replace(/-/g, "_");
  const aliases: Record<string, LatencyProfileId> = {
    A: "legacy_cascade",
    B: "flux_b_balanced",
    B_BALANCED: "flux_b_balanced",
    B_FAST: "flux_b_fast",
    B_PATIENT: "flux_b_patient",
    C: "native_audio_ultravox",
    BALANCED: "flux_b_balanced",
    FAST: "flux_b_fast",
    PATIENT: "flux_b_patient",
  };
  return aliases[key] || null;
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

  const nextVoiceLanguage: VoiceAgentConfig["voiceLanguage"] = {
    ...config.voiceLanguage,
    voiceId: nextVoiceId,
    silenceTimeoutMs:
      profile.fields.voiceLanguage.silenceTimeoutMs ??
      config.voiceLanguage?.silenceTimeoutMs ??
      2500,
    bargeIn:
      profile.fields.voiceLanguage.bargeIn ??
      config.voiceLanguage?.bargeIn !== false,
  };
  if (typeof profile.fields.voiceLanguage.endpointingMs === "number") {
    nextVoiceLanguage.endpointingMs = profile.fields.voiceLanguage.endpointingMs;
  } else if (
    profile.fields.nativeAudio ||
    isFluxEagerLatencyProfile(profileId)
  ) {
    // Flux / native-audio: do not keep a leftover local endpointingMs layer.
    delete nextVoiceLanguage.endpointingMs;
  }

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
    voiceLanguage: nextVoiceLanguage,
    model: {
      ...config.model,
      ...(profile.fields.model?.modelId
        ? { modelId: profile.fields.model.modelId }
        : {}),
    },
    callHandling: {
      ...(config.callHandling || {}),
      ...(greeting != null ? { greeting } : {}),
      // Flux / native-audio → TeXML direct; legacy cascade → Call Control.
      inboundRoutingMode:
        profileId === "legacy_cascade" ? "call_control" : "texml_direct",
      startupGreeting: {
        ...((config.callHandling as { startupGreeting?: object } | undefined)
          ?.startupGreeting || {}),
        ...(profileId === "legacy_cascade"
          ? {}
          : { enabled: false }),
      },
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
        startSpeakingPlan: profile.fields.startSpeakingPlan ?? null,
        skipDynamicVariablesWebhook: Boolean(
          profile.fields.skipDynamicVariablesWebhook,
        ),
        telnyxFieldPlan: profile.fields.telnyxFieldPlan || {},
        endpointingMsMapsTo:
          "interruption_settings.start_speaking_plan.wait_seconds only — not a separate Telnyx endpointing API",
        outgoingAudioPathNote:
          profile.fields.nativeAudio
            ? "Ultravox understands audio natively and generates text; Telnyx TTS voice_settings expected for outbound audio — verify on call"
            : "Cascade STT→LLM→Ultra TTS",
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
  const restoredEndpointing =
    typeof f.voiceLanguage.endpointingMs === "number"
      ? f.voiceLanguage.endpointingMs
      : undefined;
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
      bargeIn: f.voiceLanguage.bargeIn,
      silenceTimeoutMs: f.voiceLanguage.silenceTimeoutMs,
      ...(restoredEndpointing !== undefined
        ? { endpointingMs: restoredEndpointing }
        : {}),
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
 *
 * Flux (turn-taking): only wait_seconds — Telnyx docs say
 * transcription_endpointing_plan applies to NON turn-taking models; Flux uses
 * transcription.settings EOT instead. Do NOT send a 1.0s no-punct timer on Flux.
 *
 * Native-audio (Ultravox): omit start_speaking_plan unless proven needed —
 * status unknown / not sent for clean C benchmarks.
 *
 * Legacy nova cascade: wait + punctuation/number plan.
 */
export function buildStartSpeakingPlanFromConfig(
  config: VoiceAgentConfig,
): Record<string, unknown> | undefined {
  const diagnostics = config.voiceTiming?.diagnostics as
    | {
        startSpeakingPlan?: StartSpeakingPlanConfig | null;
        skipDynamicVariablesWebhook?: boolean;
      }
    | undefined;

  if (isNativeAudioModel(config.model?.modelId)) {
    // Explicitly clear any leftover cascade start-speaking plan.
    return {
      wait_seconds: 0.1,
      transcription_endpointing_plan: null,
    };
  }

  const profile = isLatencyProfileId(config.voiceTiming?.activeProfile)
    ? getLatencyProfile(config.voiceTiming?.activeProfile)
    : null;

  if (profile?.fields.startSpeakingPlan === null && !isDeepgramFluxModel(config.transcription?.sttModel)) {
    // Native-audio profile with null plan — still clear leftover Telnyx punctuation waits.
    return {
      wait_seconds: 0.1,
      transcription_endpointing_plan: null,
    };
  }

  const diagnosticsPlan =
    diagnostics?.startSpeakingPlan === null
      ? null
      : diagnostics?.startSpeakingPlan;

  const isFlux =
    isDeepgramFluxModel(config.transcription?.sttModel) ||
    isFluxEagerLatencyProfile(config.voiceTiming?.activeProfile);

  if (diagnosticsPlan === null && isFlux) {
    // Explicit null plan + Flux → wait only from endpointingMs / default 0.1
  }

  const plan: StartSpeakingPlanConfig =
    diagnosticsPlan ||
    profile?.fields.startSpeakingPlan ||
    (isFlux
      ? {
          waitSeconds: 0.1,
          fluxOmitTranscriptionEndpointingPlan: true,
        }
      : LEGACY_CASCADE_PROFILE.fields.startSpeakingPlan!);

  const omitEndpointingPlan =
    Boolean(plan.fluxOmitTranscriptionEndpointingPlan) || isFlux;

  // endpointingMs is a local alias for wait_seconds on legacy cascade only.
  // For Flux, turn-taking is EOT settings — do not let a leftover endpointingMs
  // from a prior profile reintroduce a competing wait.
  const waitFromEndpointing =
    !omitEndpointingPlan && config.voiceLanguage?.endpointingMs != null
      ? config.voiceLanguage.endpointingMs / 1000
      : plan.waitSeconds;

  // Allow H-aggressive 0.05; Telnyx Flux companion floor used to be 0.1.
  const waitSeconds = Math.max(
    0.05,
    Math.min(1.5, waitFromEndpointing ?? plan.waitSeconds ?? 0.1),
  );

  if (omitEndpointingPlan) {
    // Explicit null clears any previously stored punctuation/number waits on Telnyx
    // (omitting the key leaves stale 1.0s no-punct values from earlier syncs).
    return {
      wait_seconds: waitSeconds,
      transcription_endpointing_plan: null,
    };
  }

  return {
    wait_seconds: waitSeconds,
    transcription_endpointing_plan: {
      on_punctuation_seconds: plan.onPunctuationSeconds ?? 0.1,
      on_no_punctuation_seconds: plan.onNoPunctuationSeconds ?? 1.5,
      on_number_seconds: plan.onNumberSeconds ?? 1.0,
    },
  };
}

/** Whether publish should omit the dynamic-variables webhook (benchmark / B/C). */
export function shouldSkipDynamicVariablesWebhook(
  config: VoiceAgentConfig,
): boolean {
  const diagnostics = config.voiceTiming?.diagnostics as
    | { skipDynamicVariablesWebhook?: boolean }
    | undefined;
  if (diagnostics?.skipDynamicVariablesWebhook) return true;
  const profile = isLatencyProfileId(config.voiceTiming?.activeProfile)
    ? getLatencyProfile(config.voiceTiming?.activeProfile)
    : null;
  return Boolean(profile?.fields.skipDynamicVariablesWebhook);
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
