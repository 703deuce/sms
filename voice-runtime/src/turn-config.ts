import { inference } from "@livekit/agents";

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Low-latency turn handling for PSTN Amy on LiveKit.
 *
 * Defaults target ~200–2500 ms endpointing with preemptive LLM + TTS.
 * Override via VOICE_ENDPOINTING_MIN_MS, VOICE_ENDPOINTING_MAX_MS, VOICE_PREEMPTIVE_TTS.
 */
export function buildAmyTurnHandling() {
  const minDelay = readIntEnv("VOICE_ENDPOINTING_MIN_MS", 200);
  const maxDelay = readIntEnv("VOICE_ENDPOINTING_MAX_MS", 2000);
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
  const handling = buildAmyTurnHandling();
  return {
    endpointing: handling.endpointing,
    preemptiveGeneration: handling.preemptiveGeneration,
  };
}
