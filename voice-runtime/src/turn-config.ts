import { inference } from "@livekit/agents";

/**
 * Endpointing benchmarks — tune fast → natural, not slow → fast.
 *
 * ultra_low (default): 100 / 400 ms dynamic + LiveKit TurnDetector
 * flux_eager:          Deepgram Flux STT+EOT (0.3 / 0.7) — no TurnDetector
 * test_a:              150 / 800 ms dynamic
 * test_b:              200 / 1000 ms dynamic
 * test_c:              250 / 1200 ms dynamic
 * receptionist_legacy: old 300 / 2500 ms fixed ceiling (rollback)
 */
export const VOICE_TURN_PRESETS = [
  "ultra_low",
  "flux_eager",
  "test_a",
  "test_b",
  "test_c",
  "receptionist_legacy",
  // backward-compatible aliases
  "receptionist",
  "low_latency",
  "aggressive",
] as const;

export type VoiceTurnPreset = (typeof VOICE_TURN_PRESETS)[number];

type EndpointingPreset = {
  minDelay: number;
  maxDelay: number;
  mode: "fixed" | "dynamic";
};

type TurnPresetKind = "turn_detector" | "flux_stt";

type TurnPresetDefinition = {
  kind: TurnPresetKind;
  endpointing?: EndpointingPreset;
};

const PRESET_DEFAULTS: Record<string, TurnPresetDefinition> = {
  ultra_low: {
    kind: "turn_detector",
    endpointing: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
  },
  flux_eager: { kind: "flux_stt" },
  test_a: {
    kind: "turn_detector",
    endpointing: { minDelay: 150, maxDelay: 800, mode: "dynamic" },
  },
  test_b: {
    kind: "turn_detector",
    endpointing: { minDelay: 200, maxDelay: 1000, mode: "dynamic" },
  },
  test_c: {
    kind: "turn_detector",
    endpointing: { minDelay: 250, maxDelay: 1200, mode: "dynamic" },
  },
  receptionist_legacy: {
    kind: "turn_detector",
    endpointing: { minDelay: 300, maxDelay: 2500, mode: "fixed" },
  },
  // aliases
  receptionist: {
    kind: "turn_detector",
    endpointing: { minDelay: 300, maxDelay: 2500, mode: "fixed" },
  },
  low_latency: {
    kind: "turn_detector",
    endpointing: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
  },
  aggressive: {
    kind: "turn_detector",
    endpointing: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
  },
};

/** Minimal post-Flux padding — Flux EOT is the primary turn signal. */
const FLUX_STT_ENDPOINTING: EndpointingPreset = {
  minDelay: 0,
  maxDelay: 50,
  mode: "dynamic",
};

function readIntEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getResolvedTurnPreset(): string {
  const raw = (process.env.VOICE_TURN_PRESET || "ultra_low").trim().toLowerCase();
  if (raw in PRESET_DEFAULTS) return raw;
  return "ultra_low";
}

export function isFluxEagerPreset(preset = getResolvedTurnPreset()): boolean {
  return PRESET_DEFAULTS[preset]?.kind === "flux_stt";
}

function resolvePresetDefinition(preset: string): TurnPresetDefinition {
  return PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.ultra_low;
}

export function buildAmyTurnHandling() {
  const preset = getResolvedTurnPreset();
  const definition = resolvePresetDefinition(preset);
  const preemptiveTts = readBoolEnv("VOICE_PREEMPTIVE_TTS", true);
  const preemptiveGeneration = {
    enabled: true,
    preemptiveTts,
  };
  const interruption = {
    enabled: true,
  };

  if (definition.kind === "flux_stt") {
    const defaults = FLUX_STT_ENDPOINTING;
    const minDelay = readIntEnv("VOICE_ENDPOINTING_MIN_MS") ?? defaults.minDelay;
    const maxDelay = readIntEnv("VOICE_ENDPOINTING_MAX_MS") ?? defaults.maxDelay;
    const mode =
      (process.env.VOICE_ENDPOINTING_MODE?.trim().toLowerCase() as "fixed" | "dynamic") ||
      defaults.mode;

    return {
      turnDetection: "stt" as const,
      endpointing: {
        mode: mode === "dynamic" ? ("dynamic" as const) : ("fixed" as const),
        minDelay,
        maxDelay,
      },
      interruption,
      preemptiveGeneration,
    };
  }

  const defaults = definition.endpointing ?? PRESET_DEFAULTS.ultra_low.endpointing!;
  const minDelay = readIntEnv("VOICE_ENDPOINTING_MIN_MS") ?? defaults.minDelay;
  const maxDelay = readIntEnv("VOICE_ENDPOINTING_MAX_MS") ?? defaults.maxDelay;
  const mode =
    (process.env.VOICE_ENDPOINTING_MODE?.trim().toLowerCase() as "fixed" | "dynamic") ||
    defaults.mode;

  return {
    turnDetection: new inference.TurnDetector(),
    endpointing: {
      mode: mode === "dynamic" ? ("dynamic" as const) : ("fixed" as const),
      minDelay,
      maxDelay,
    },
    interruption,
    preemptiveGeneration,
  };
}

export function describeTurnHandlingConfig(): Record<string, unknown> {
  const preset = getResolvedTurnPreset();
  const handling = buildAmyTurnHandling();
  const flux = isFluxEagerPreset(preset);

  return {
    preset,
    turnDetection: flux ? "stt" : "inference.TurnDetector",
    turnDetector: flux ? null : "inference.TurnDetector",
    fluxEot: flux
      ? {
          eagerEotThreshold:
            Number(process.env.VOICE_FLUX_EAGER_EOT_THRESHOLD?.trim()) || 0.3,
          eotThreshold: Number(process.env.VOICE_FLUX_EOT_THRESHOLD?.trim()) || 0.7,
          eotTimeoutMs: Number(process.env.VOICE_FLUX_EOT_TIMEOUT_MS?.trim()) || 5000,
          sttModel: process.env.VOICE_STT_MODEL?.trim() || "deepgram/flux-general-en",
        }
      : null,
    endpointing: handling.endpointing,
    preemptiveGeneration: handling.preemptiveGeneration,
    notes: flux
      ? "flux_eager: Deepgram Flux STT+EOT (0.3/0.7). No LiveKit TurnDetector."
      : "Default ultra_low: 100/400ms dynamic + TurnDetector. Use flux_eager to A/B Flux EOT.",
  };
}

export function getPreemptiveConfigForInstrumentation(): {
  enabled: boolean;
  preemptiveTts: boolean;
} {
  const handling = buildAmyTurnHandling();
  return {
    enabled: handling.preemptiveGeneration.enabled !== false,
    preemptiveTts: Boolean(handling.preemptiveGeneration.preemptiveTts),
  };
}
