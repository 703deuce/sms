/**
 * Transovo voice timing presets — production baseline for turn-taking,
 * interruption, silence, speech limits, and latency targets.
 *
 * Provider mapping rules:
 * - Map only fields Telnyx currently supports on AI Assistants.
 * - Keep Transovo targets / diagnostics / instruction guidance separate.
 * - Default STT (deepgram/nova-3) uses start_speaking_plan endpointing.
 * - assemblyai/universal-streaming and deepgram/flux get transcription.settings EOT fields.
 */

export const VOICE_TIMING_PRESET_IDS = [
  "NATURAL_DEFAULT",
  "FAST_RECEPTIONIST",
  "PATIENT_INTAKE",
  "NOISY_ENVIRONMENT",
] as const;

export type VoiceTimingPresetId = (typeof VOICE_TIMING_PRESET_IDS)[number];

/** Non-Astra default speaking speed (product requirement). */
export const DEFAULT_AGENT_VOICE_SPEED = 1.3;
/** Astra keeps a natural/slower delivery. */
export const ASTRA_VOICE_SPEED = 0.98;

export type ResponseLatencyTargets = {
  medianTargetMs: number;
  medianAcceptableMs: number;
  medianWarningMs: number;
  medianCriticalMs: number;
  p95TargetMs: number;
  p95CriticalMs: number;
};

export type VoiceTimingPreset = {
  id: VoiceTimingPresetId;
  label: string;
  description: string;
  responseLatencyTargets: ResponseLatencyTargets;
  turnDetection: {
    endOfTurnConfidenceThreshold: number;
    minTurnSilenceMs: number;
    maxTurnSilenceMs: number;
    responseStartDelayMs: number;
    /** Deepgram Flux */
    eotThreshold: number;
    eagerEotThreshold: number;
    eotTimeoutMs: number;
    /** Non-turn-taking models (nova-3, etc.) via start_speaking_plan */
    onPunctuationSeconds: number;
    onNoPunctuationSeconds: number;
    onNumberSeconds: number;
  };
  interruption: {
    enabled: boolean;
    /** Relative 0–1 sensitivity (Transovo); Telnyx only exposes enable. */
    sensitivityNormalized: number;
    minimumSpeechMs: number;
    stopAudioTargetMs: number;
    audioPreRollMs: number;
    falseInterruptionRecovery: boolean;
  };
  silence: {
    firstRepromptMs: number;
    secondRepromptMs: number;
    finalTimeoutMs: number;
  };
  speech: {
    /** Non-Astra preset speed. Astra is resolved separately. */
    speed: number;
    maximumSentencesPerTurn: number;
    targetMaximumWordsPerTurn: number;
    maximumOptionsSpoken: number;
    oneQuestionPerTurn: boolean;
  };
  backchannel: {
    enabled: boolean;
    probability: number;
    minimumCallerSpeechMs: number;
    disableDuringStructuredDataCollection: boolean;
  };
};

export const SHARED_LATENCY_TARGETS: ResponseLatencyTargets = {
  medianTargetMs: 500,
  medianAcceptableMs: 800,
  medianWarningMs: 1000,
  medianCriticalMs: 1500,
  p95TargetMs: 1200,
  p95CriticalMs: 2000,
};

const NATURAL_DEFAULT: VoiceTimingPreset = {
  id: "NATURAL_DEFAULT",
  label: "Natural default",
  description: "Balanced receptionist / booking agent timing.",
  responseLatencyTargets: SHARED_LATENCY_TARGETS,
  turnDetection: {
    endOfTurnConfidenceThreshold: 0.45,
    minTurnSilenceMs: 350,
    maxTurnSilenceMs: 1000,
    responseStartDelayMs: 200,
    eotThreshold: 0.8,
    eagerEotThreshold: 0.4,
    eotTimeoutMs: 2500,
    onPunctuationSeconds: 0.1,
    onNoPunctuationSeconds: 0.35,
    onNumberSeconds: 0.55,
  },
  interruption: {
    enabled: true,
    sensitivityNormalized: 0.85,
    minimumSpeechMs: 250,
    stopAudioTargetMs: 150,
    audioPreRollMs: 300,
    falseInterruptionRecovery: true,
  },
  silence: {
    firstRepromptMs: 5000,
    secondRepromptMs: 10000,
    finalTimeoutMs: 18000,
  },
  speech: {
    speed: DEFAULT_AGENT_VOICE_SPEED,
    maximumSentencesPerTurn: 2,
    targetMaximumWordsPerTurn: 25,
    maximumOptionsSpoken: 2,
    oneQuestionPerTurn: true,
  },
  backchannel: {
    enabled: true,
    probability: 0.15,
    minimumCallerSpeechMs: 3000,
    disableDuringStructuredDataCollection: true,
  },
};

const FAST_RECEPTIONIST: VoiceTimingPreset = {
  ...NATURAL_DEFAULT,
  id: "FAST_RECEPTIONIST",
  label: "Fast receptionist",
  description: "Snappy routing, hours, yes/no, and short answers.",
  turnDetection: {
    ...NATURAL_DEFAULT.turnDetection,
    endOfTurnConfidenceThreshold: 0.4,
    minTurnSilenceMs: 275,
    maxTurnSilenceMs: 850,
    responseStartDelayMs: 100,
    eotThreshold: 0.75,
    eagerEotThreshold: 0.35,
    eotTimeoutMs: 2000,
    onPunctuationSeconds: 0.08,
    onNoPunctuationSeconds: 0.28,
    onNumberSeconds: 0.45,
  },
  interruption: {
    ...NATURAL_DEFAULT.interruption,
    sensitivityNormalized: 0.9,
    minimumSpeechMs: 200,
  },
  speech: {
    ...NATURAL_DEFAULT.speech,
    speed: 1.35,
    targetMaximumWordsPerTurn: 20,
  },
};

const PATIENT_INTAKE: VoiceTimingPreset = {
  ...NATURAL_DEFAULT,
  id: "PATIENT_INTAKE",
  label: "Patient intake",
  description: "Addresses, long explanations, legal/medical intake, thoughtful pauses.",
  turnDetection: {
    ...NATURAL_DEFAULT.turnDetection,
    endOfTurnConfidenceThreshold: 0.55,
    minTurnSilenceMs: 500,
    maxTurnSilenceMs: 1500,
    responseStartDelayMs: 350,
    eotThreshold: 0.85,
    eagerEotThreshold: 0.45,
    eotTimeoutMs: 3000,
    onPunctuationSeconds: 0.15,
    onNoPunctuationSeconds: 0.5,
    onNumberSeconds: 0.8,
  },
  interruption: {
    ...NATURAL_DEFAULT.interruption,
    sensitivityNormalized: 0.75,
    minimumSpeechMs: 350,
  },
  speech: {
    ...NATURAL_DEFAULT.speech,
    speed: 1.22,
    targetMaximumWordsPerTurn: 30,
  },
};

const NOISY_ENVIRONMENT: VoiceTimingPreset = {
  ...NATURAL_DEFAULT,
  id: "NOISY_ENVIRONMENT",
  label: "Noisy environment",
  description: "Cars, outdoors, shops, speakerphone — fewer false interruptions.",
  turnDetection: {
    ...NATURAL_DEFAULT.turnDetection,
    endOfTurnConfidenceThreshold: 0.55,
    minTurnSilenceMs: 450,
    maxTurnSilenceMs: 1400,
    responseStartDelayMs: 300,
    eotThreshold: 0.85,
    eagerEotThreshold: 0.5,
    eotTimeoutMs: 3000,
    onPunctuationSeconds: 0.15,
    onNoPunctuationSeconds: 0.45,
    onNumberSeconds: 0.7,
  },
  interruption: {
    ...NATURAL_DEFAULT.interruption,
    sensitivityNormalized: 0.7,
    minimumSpeechMs: 450,
    audioPreRollMs: 300,
    falseInterruptionRecovery: true,
  },
  speech: {
    ...NATURAL_DEFAULT.speech,
    speed: 1.28,
  },
};

export const VOICE_TIMING_PRESETS: Record<VoiceTimingPresetId, VoiceTimingPreset> = {
  NATURAL_DEFAULT,
  FAST_RECEPTIONIST,
  PATIENT_INTAKE,
  NOISY_ENVIRONMENT,
};

export function isVoiceTimingPresetId(value: unknown): value is VoiceTimingPresetId {
  return (
    typeof value === "string" &&
    (VOICE_TIMING_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function getVoiceTimingPreset(
  id?: string | null,
): VoiceTimingPreset {
  if (isVoiceTimingPresetId(id)) return VOICE_TIMING_PRESETS[id];
  return VOICE_TIMING_PRESETS.NATURAL_DEFAULT;
}

/** True for Astra / catalog Ava (NaturalHD.astra). */
export function isAstraVoice(voiceId?: string | null): boolean {
  const raw = String(voiceId || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "ava-warm-us" || raw === "astra") return true;
  if (raw === "telnyx.naturalhd.astra") return true;
  if (raw.endsWith(".astra")) return true;
  if (raw.includes("naturalhd.astra")) return true;
  return false;
}

/**
 * Resolve speaking speed: explicit config wins; otherwise Astra → 0.98,
 * all other voices → preset/default 1.3 (or the preset's non-Astra speed).
 */
export function resolveVoiceSpeed(opts: {
  voiceId?: string | null;
  explicitSpeed?: number | null;
  presetSpeed?: number | null;
}): number {
  if (opts.explicitSpeed != null && Number.isFinite(opts.explicitSpeed)) {
    return Number(opts.explicitSpeed);
  }
  if (isAstraVoice(opts.voiceId)) return ASTRA_VOICE_SPEED;
  if (opts.presetSpeed != null && Number.isFinite(opts.presetSpeed)) {
    return Number(opts.presetSpeed);
  }
  return DEFAULT_AGENT_VOICE_SPEED;
}

export function isTurnTakingSttModel(model?: string | null): boolean {
  const m = String(model || "").toLowerCase();
  return m === "deepgram/flux" || m === "assemblyai/universal-streaming";
}

export function isAssemblyAiTurnModel(model?: string | null): boolean {
  return String(model || "").toLowerCase() === "assemblyai/universal-streaming";
}

export function isDeepgramFluxModel(model?: string | null): boolean {
  return String(model || "").toLowerCase() === "deepgram/flux";
}

/** Telnyx-supported transcription.settings for turn-taking STT models. */
export function buildTelnyxTranscriptionSettings(
  sttModel: string,
  preset: VoiceTimingPreset,
): Record<string, unknown> | undefined {
  if (isDeepgramFluxModel(sttModel)) {
    return {
      eot_threshold: preset.turnDetection.eotThreshold,
      eager_eot_threshold: preset.turnDetection.eagerEotThreshold,
      eot_timeout_ms: preset.turnDetection.eotTimeoutMs,
    };
  }
  if (isAssemblyAiTurnModel(sttModel)) {
    return {
      end_of_turn_confidence_threshold:
        preset.turnDetection.endOfTurnConfidenceThreshold,
      min_turn_silence: preset.turnDetection.minTurnSilenceMs,
      max_turn_silence: preset.turnDetection.maxTurnSilenceMs,
    };
  }
  // nova-3 / others: smart format helpers only (no EOT fields on Telnyx).
  if (String(sttModel).toLowerCase().startsWith("deepgram/nova")) {
    return {
      smart_format: true,
      numerals: true,
    };
  }
  return undefined;
}

/**
 * Telnyx interruption_settings from a preset.
 * start_speaking_plan endpointing applies to non-turn-taking models;
 * for Flux, still send a low wait_seconds (Telnyx recommends ~0.1s).
 */
export function buildTelnyxInterruptionSettings(
  preset: VoiceTimingPreset,
  opts?: { bargeIn?: boolean | null; sttModel?: string | null },
): Record<string, unknown> {
  const enable =
    preset.interruption.enabled && opts?.bargeIn !== false;
  const waitSec = Math.max(
    0.05,
    Math.min(1.5, preset.turnDetection.responseStartDelayMs / 1000),
  );
  const startSpeakingPlan: Record<string, unknown> = {
    wait_seconds: waitSec,
  };
  if (!isTurnTakingSttModel(opts?.sttModel)) {
    startSpeakingPlan.transcription_endpointing_plan = {
      on_punctuation_seconds: preset.turnDetection.onPunctuationSeconds,
      on_no_punctuation_seconds: preset.turnDetection.onNoPunctuationSeconds,
      on_number_seconds: preset.turnDetection.onNumberSeconds,
    };
  }
  return {
    enable,
    disable_greeting_interruption: true,
    start_speaking_plan: startSpeakingPlan,
  };
}

/** Telnyx only exposes a single idle reply timer — map first check-in. */
export function buildTelnyxUserIdleReplySecs(preset: VoiceTimingPreset): number {
  return Math.max(
    5,
    Math.min(30, Math.round(preset.silence.firstRepromptMs / 1000)),
  );
}

/** Instruction guidance for fields Telnyx cannot configure numerically. */
export function buildTimingInstructionGuidance(preset: VoiceTimingPreset): string {
  const lines: string[] = [
    "VOICE TIMING GUIDANCE (follow closely):",
    `- Keep spoken replies short: prefer ≤${preset.speech.targetMaximumWordsPerTurn} words and ≤${preset.speech.maximumSentencesPerTurn} sentences per turn.`,
    `- Ask at most one question per turn.`,
    `- When offering choices, speak at most ${preset.speech.maximumOptionsSpoken} options, then ask which they prefer.`,
    `- If an answer needs more than ~40 spoken words, give a short part and ask if they want more.`,
  ];
  if (preset.backchannel.enabled) {
    lines.push(
      `- Occasional brief backchannels ("okay", "got it") are allowed (~${Math.round(preset.backchannel.probability * 100)}% of long turns) only after the caller has spoken for several seconds.`,
      "- Never backchannel while collecting phone numbers, emails, addresses, confirmation codes, or appointment dates.",
    );
  } else {
    lines.push("- Do not use backchannels.");
  }
  lines.push(
    `- If the caller is silent: first soft check-in around ${Math.round(preset.silence.firstRepromptMs / 1000)}s ("Are you still there?"), second around ${Math.round(preset.silence.secondRepromptMs / 1000)}s, then offer a callback around ${Math.round(preset.silence.finalTimeoutMs / 1000)}s. Do not reprompt every couple of seconds.`,
  );
  if (preset.interruption.falseInterruptionRecovery) {
    lines.push(
      "- If you stop speaking because of background noise and the caller was not addressing you, briefly continue where you left off.",
    );
  }
  return lines.join("\n");
}

export type ResolvedVoiceTiming = {
  preset: VoiceTimingPreset;
  speed: number;
  /** Legacy field used by older sync paths (ms → wait_seconds). */
  endpointingMs: number;
  silenceTimeoutMs: number;
  bargeIn: boolean;
  /** Snapshot stored on agent config for diagnostics (not all fields go to Telnyx). */
  diagnostics: {
    responseLatencyTargets: ResponseLatencyTargets;
    stopAudioTargetMs: number;
    audioPreRollMs: number;
    minimumInterruptSpeechMs: number;
    sensitivityNormalized: number;
    falseInterruptionRecovery: boolean;
    backchannel: VoiceTimingPreset["backchannel"];
    speechLimits: Omit<VoiceTimingPreset["speech"], "speed">;
  };
};

export function resolveVoiceTiming(input: {
  presetId?: string | null;
  voiceId?: string | null;
  /** When set, overrides preset/default speed resolution. */
  explicitSpeed?: number | null;
  bargeIn?: boolean | null;
}): ResolvedVoiceTiming {
  const preset = getVoiceTimingPreset(input.presetId);
  const speed = resolveVoiceSpeed({
    voiceId: input.voiceId,
    explicitSpeed: input.explicitSpeed,
    presetSpeed: preset.speech.speed,
  });
  const bargeIn =
    input.bargeIn !== false && preset.interruption.enabled;
  return {
    preset,
    speed,
    endpointingMs: preset.turnDetection.responseStartDelayMs,
    silenceTimeoutMs: preset.silence.firstRepromptMs,
    bargeIn,
    diagnostics: {
      responseLatencyTargets: preset.responseLatencyTargets,
      stopAudioTargetMs: preset.interruption.stopAudioTargetMs,
      audioPreRollMs: preset.interruption.audioPreRollMs,
      minimumInterruptSpeechMs: preset.interruption.minimumSpeechMs,
      sensitivityNormalized: preset.interruption.sensitivityNormalized,
      falseInterruptionRecovery: preset.interruption.falseInterruptionRecovery,
      backchannel: preset.backchannel,
      speechLimits: {
        maximumSentencesPerTurn: preset.speech.maximumSentencesPerTurn,
        targetMaximumWordsPerTurn: preset.speech.targetMaximumWordsPerTurn,
        maximumOptionsSpoken: preset.speech.maximumOptionsSpoken,
        oneQuestionPerTurn: preset.speech.oneQuestionPerTurn,
      },
    },
  };
}
