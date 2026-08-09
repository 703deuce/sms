import { inference } from "@livekit/agents";

/**
 * Endpointing benchmarks — tune fast → natural, not slow → fast.
 *
 * ultra_low (default): 100 / 400 ms dynamic — Telnyx-class target
 * test_a:              150 / 800 ms dynamic
 * test_b:              200 / 1000 ms dynamic
 * test_c:              250 / 1200 ms dynamic
 * receptionist_legacy: old 300 / 2500 ms fixed ceiling (rollback)
 */
export const VOICE_TURN_PRESETS = [
  "ultra_low",
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

const PRESET_DEFAULTS: Record<string, EndpointingPreset> = {
  ultra_low: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
  test_a: { minDelay: 150, maxDelay: 800, mode: "dynamic" },
  test_b: { minDelay: 200, maxDelay: 1000, mode: "dynamic" },
  test_c: { minDelay: 250, maxDelay: 1200, mode: "dynamic" },
  receptionist_legacy: { minDelay: 300, maxDelay: 2500, mode: "fixed" },
  // aliases
  receptionist: { minDelay: 300, maxDelay: 2500, mode: "fixed" },
  low_latency: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
  aggressive: { minDelay: 100, maxDelay: 400, mode: "dynamic" },
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

function resolvePreset(): string {
  const raw = (process.env.VOICE_TURN_PRESET || "ultra_low").trim().toLowerCase();
  if (raw in PRESET_DEFAULTS) return raw;
  return "ultra_low";
}

export function buildAmyTurnHandling() {
  const preset = resolvePreset();
  const defaults = PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.ultra_low;
  const minDelay = readIntEnv("VOICE_ENDPOINTING_MIN_MS") ?? defaults.minDelay;
  const maxDelay = readIntEnv("VOICE_ENDPOINTING_MAX_MS") ?? defaults.maxDelay;
  const preemptiveTts = readBoolEnv("VOICE_PREEMPTIVE_TTS", true);
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
      "Default ultra_low: 100/400ms dynamic. Raise to test_a/test_b if Amy clips mid-sentence pauses.",
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
