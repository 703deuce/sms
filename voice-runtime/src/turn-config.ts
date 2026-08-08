import { inference } from "@livekit/agents";

export const VOICE_TURN_PRESETS = ["receptionist", "low_latency", "aggressive"] as const;
export type VoiceTurnPreset = (typeof VOICE_TURN_PRESETS)[number];

const PRESET_DEFAULTS: Record<VoiceTurnPreset, { minDelay: number; maxDelay: number }> = {
  /** LiveKit streaming TurnDetector defaults — balanced for PSTN receptionist. */
  receptionist: { minDelay: 300, maxDelay: 2500 },
  /** Tighter without going to VAD-only. Opt-in via VOICE_TURN_PRESET=low_latency. */
  low_latency: { minDelay: 250, maxDelay: 2000 },
  /** Benchmark only — may clip thoughtful pauses. Requires explicit preset. */
  aggressive: { minDelay: 200, maxDelay: 1800 },
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

function resolvePreset(): VoiceTurnPreset {
  const raw = (process.env.VOICE_TURN_PRESET || "receptionist").trim().toLowerCase();
  if ((VOICE_TURN_PRESETS as readonly string[]).includes(raw)) {
    return raw as VoiceTurnPreset;
  }
  return "receptionist";
}

/**
 * Turn handling tuned for telephone receptionist conversation.
 * Uses LiveKit semantic TurnDetector; endpointing overrides are env-tunable.
 */
export function buildAmyTurnHandling() {
  const preset = resolvePreset();
  const defaults = PRESET_DEFAULTS[preset];
  const minDelay = readIntEnv("VOICE_ENDPOINTING_MIN_MS") ?? defaults.minDelay;
  const maxDelay = readIntEnv("VOICE_ENDPOINTING_MAX_MS") ?? defaults.maxDelay;
  const preemptiveTts = readBoolEnv("VOICE_PREEMPTIVE_TTS", true);

  return {
    turnDetection: new inference.TurnDetector(),
    endpointing: {
      mode: "fixed" as const,
      minDelay,
      maxDelay,
    },
    interruption: {
      enabled: true,
    },
    preemptiveGeneration: {
      enabled: true,
      preemptiveTts,
    },
  };
}

export function describeTurnHandlingConfig(): Record<string, unknown> {
  const preset = resolvePreset();
  const handling = buildAmyTurnHandling();
  return {
    preset,
    endpointing: handling.endpointing,
    preemptiveGeneration: handling.preemptiveGeneration,
    turnDetector: "inference.TurnDetector",
    notes:
      "receptionist=300/2500ms (default). Set VOICE_TURN_PRESET=low_latency or aggressive to benchmark.",
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
