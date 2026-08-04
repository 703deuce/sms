/**
 * Cascaded-pipeline latency profiles for Telnyx AI Assistants.
 *
 * Goal: approach full-duplex feel (PersonaPlex/Moshi-class) without replacing
 * the STT → LLM → TTS stack — by starting speculative LLM work before final
 * end-of-turn and streaming the first safe clause into TTS ASAP.
 *
 * Profiles:
 * - legacy_cascade: previous Transovo defaults (nova-3 + endpointingMs 300)
 * - flux_eager_low_latency: Deepgram Flux + eager EOT + 0.1s start wait
 *
 * Applying a profile always snapshots the prior provider-facing fields into
 * `voiceTiming.rollbackSnapshot` so operators can roll back without recreating agents.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export const LATENCY_PROFILE_IDS = [
  "legacy_cascade",
  "flux_eager_low_latency",
] as const;

export type LatencyProfileId = (typeof LATENCY_PROFILE_IDS)[number];

export const ACTIVE_LATENCY_PROFILE_DEFAULT: LatencyProfileId = "legacy_cascade";

/** Ordinary-turn perceived latency bands (reporting only — not artificial delays). */
export const ORDINARY_TURN_LATENCY_BANDS = {
  stretchGoalMs: 400,
  productionGoalMs: 600,
  acceptableMs: 800,
  slowMs: 1000,
  investigateMs: 1000,
} as const;

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
  };
};

export type LatencyProfileRollbackSnapshot = {
  capturedAt: string;
  fromProfile: LatencyProfileId | "custom" | null;
  fields: LatencyProfileProviderFields;
};

export type LatencyProfileDefinition = {
  id: LatencyProfileId;
  label: string;
  description: string;
  /** Telnyx-documented / verified provider values for this profile. */
  fields: LatencyProfileProviderFields;
};

/**
 * Backup / previous production behavior.
 * deepgram/nova-3 + wait_seconds from endpointingMs 300 (pre-Flux).
 */
export const LEGACY_CASCADE_PROFILE: LatencyProfileDefinition = {
  id: "legacy_cascade",
  label: "Legacy cascade (rollback)",
  description:
    "Previous Transovo defaults: Deepgram Nova-3 with endpointing wait ~300 ms. No Flux eager EOT.",
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
    },
  },
};

/**
 * Active low-latency profile.
 * Telnyx Portal Flux defaults: eot_threshold 0.8, eager_eot_threshold 0.4.
 * eot_timeout_ms omitted → provider default (do not invent a timeout).
 * Start-speaking wait 0.10s where supported (Flux recommendation).
 */
export const FLUX_EAGER_LOW_LATENCY_PROFILE: LatencyProfileDefinition = {
  id: "flux_eager_low_latency",
  label: "Flux eager low-latency (A/B experiment)",
  description:
    "Opt-in A/B only — Deepgram Flux with Telnyx Portal defaults for eager EOT; 100 ms start-speaking wait. Do not auto-migrate production agents.",
  fields: {
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/flux",
      language: "en",
      settings: {
        eot_threshold: 0.8,
        eager_eot_threshold: 0.4,
        // eot_timeout_ms intentionally omitted — preserve Telnyx/provider default
      },
    },
    voiceLanguage: {
      endpointingMs: 100,
      silenceTimeoutMs: 2500,
      bargeIn: true,
    },
  },
};

export const LATENCY_PROFILES: Record<LatencyProfileId, LatencyProfileDefinition> =
  {
    legacy_cascade: LEGACY_CASCADE_PROFILE,
    flux_eager_low_latency: FLUX_EAGER_LOW_LATENCY_PROFILE,
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

/** Snapshot only the provider-facing fields a profile may change. */
export function snapshotProviderLatencyFields(
  config: VoiceAgentConfig,
): LatencyProfileProviderFields {
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
  };
}

function currentProfileId(config: VoiceAgentConfig): LatencyProfileId | "custom" | null {
  const id = config.voiceTiming?.activeProfile;
  if (isLatencyProfileId(id)) return id;
  return null;
}

/**
 * Apply a latency profile onto agent config.
 * Always writes `voiceTiming.rollbackSnapshot` from the *current* fields first
 * (unless `preserveExistingRollback` and a snapshot already exists).
 */
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

  return {
    ...config,
    transcription: {
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
      endpointingMs: profile.fields.voiceLanguage.endpointingMs,
      silenceTimeoutMs:
        profile.fields.voiceLanguage.silenceTimeoutMs ??
        config.voiceLanguage?.silenceTimeoutMs ??
        2500,
      bargeIn:
        profile.fields.voiceLanguage.bargeIn ??
        config.voiceLanguage?.bargeIn !== false,
    },
    voiceTiming: {
      ...(config.voiceTiming || {}),
      activeProfile: profileId,
      experimental: false,
      rollbackSnapshot: rollbackSnapshot as unknown as Record<string, unknown>,
      diagnostics: {
        ...(config.voiceTiming?.diagnostics || {}),
        ordinaryTurnGoalMs: ORDINARY_TURN_LATENCY_BANDS.productionGoalMs,
        metric:
          "caller_end_of_speech_to_first_audible_agent_audio",
        note: "Bands are reporting targets, not artificial delays.",
      },
    },
  };
}

/** Restore provider fields from `voiceTiming.rollbackSnapshot`. */
export function rollbackLatencyProfileConfig(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const snap = config.voiceTiming?.rollbackSnapshot as
    | LatencyProfileRollbackSnapshot
    | undefined;
  if (!snap?.fields) {
    // No snapshot — fall back to legacy cascade definition.
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

export function isDeepgramFluxModel(model?: string | null): boolean {
  return String(model || "").toLowerCase() === "deepgram/flux";
}

/**
 * Telnyx transcription.settings for Flux (only).
 * Omits eot_timeout_ms unless the agent config explicitly set it.
 */
export function buildFluxTranscriptionSettings(
  config: VoiceAgentConfig,
): Record<string, unknown> | undefined {
  const model =
    config.transcription?.sttModel?.trim() ||
    process.env.VOICE_TRANSCRIPTION_MODEL?.trim() ||
    "";
  if (!isDeepgramFluxModel(model)) return undefined;

  const explicit = config.transcription?.settings || {};
  const settings: Record<string, unknown> = {
    eot_threshold:
      typeof explicit.eot_threshold === "number"
        ? explicit.eot_threshold
        : 0.8,
    eager_eot_threshold:
      typeof explicit.eager_eot_threshold === "number"
        ? explicit.eager_eot_threshold
        : 0.4,
  };
  if (typeof explicit.eot_timeout_ms === "number") {
    settings.eot_timeout_ms = explicit.eot_timeout_ms;
  }
  if (typeof explicit.keyterm === "string" && explicit.keyterm.trim()) {
    settings.keyterm = explicit.keyterm.trim();
  } else if (config.transcription?.keyterms?.length) {
    settings.keyterm = config.transcription.keyterms.join(",");
  }
  return settings;
}

/**
 * Soft prompt additions for low-latency conversational behavior.
 * Prompt guidance only — not hard truncation.
 */
export const LOW_LATENCY_CONVERSATION_GUIDANCE = [
  "LOW-LATENCY CONVERSATION:",
  "- Lead with the answer in the first short clause; do not wait to compose a long paragraph.",
  "- One question per turn; one or two short sentences.",
  "- For appointment choices, offer two options first.",
  "- Do not narrate tools, APIs, or internal reasoning.",
  "- Only before a real external wait (calendar/API), say one brief acknowledgement such as \"Sure, let me check.\" — never stack fillers on ordinary turns.",
  "- Stop speaking as soon as the caller has enough information.",
].join("\n");
