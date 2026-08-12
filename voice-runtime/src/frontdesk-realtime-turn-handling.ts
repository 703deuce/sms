import type { AgentSessionOptions } from "@livekit/agents";

function parseNumberEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * LiveKit interruption tuning for inbound front desk + OpenAI Realtime.
 * Realtime server VAD owns barge-in; these options handle false-interruption resume.
 */
export function buildFrontDeskRealtimeTurnHandling(): NonNullable<
  AgentSessionOptions["turnHandling"]
> {
  return {
    turnDetection: null,
    interruption: {
      enabled: true,
      minDuration: parseNumberEnv(process.env.VOICE_INTERRUPTION_MIN_DURATION_MS, 650),
      falseInterruptionTimeout: parseNumberEnv(
        process.env.VOICE_FALSE_INTERRUPTION_TIMEOUT_MS,
        1000,
      ),
      resumeFalseInterruption: true,
      minWords: 0,
    },
  };
}
