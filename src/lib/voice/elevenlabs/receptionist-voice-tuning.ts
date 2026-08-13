import type { VoiceAgentConfig } from "@/lib/voice/types";

/** Customer-facing expressiveness preset — maps to ElevenLabs stability. */
export type VoiceExpressiveness = "calm" | "balanced" | "expressive";

export const EXPRESSIVENESS_LABELS: Record<
  VoiceExpressiveness,
  { label: string; description: string }
> = {
  calm: { label: "Calm", description: "Steady and consistent" },
  balanced: { label: "Balanced", description: "Natural everyday delivery" },
  expressive: { label: "Expressive", description: "More dynamic and varied" },
};

/** ElevenLabs stability targets for each expressiveness preset. */
export const EXPRESSIVENESS_STABILITY: Record<VoiceExpressiveness, number> = {
  calm: 0.7,
  balanced: 0.45,
  expressive: 0.35,
};

export const ELEVENLABS_SPEED_MIN = 0.7;
export const ELEVENLABS_SPEED_MAX = 1.2;

export const DEFAULT_RECEPTIONIST_VOICE_TUNING = {
  speed: 1.08,
  stability: 0.45,
  similarityBoost: 0.75,
  style: 0.1,
  speakerBoost: false,
} as const;

export type ResolvedReceptionistElevenLabsTuning = {
  speed: number;
  stability: number;
  similarityBoost: number;
  style: number;
  speakerBoost: boolean;
};

export function clampElevenLabsSpeed(speed: number): number {
  return Math.min(ELEVENLABS_SPEED_MAX, Math.max(ELEVENLABS_SPEED_MIN, speed));
}

export function stabilityToExpressiveness(stability: number): VoiceExpressiveness {
  let best: VoiceExpressiveness = "balanced";
  let bestDist = Infinity;
  for (const [key, target] of Object.entries(EXPRESSIVENESS_STABILITY) as [
    VoiceExpressiveness,
    number,
  ][]) {
    const dist = Math.abs(stability - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

export function expressivenessToStability(preset: VoiceExpressiveness): number {
  return EXPRESSIVENESS_STABILITY[preset];
}

function finiteOr<T>(value: unknown, fallback: T): T {
  return typeof value === "number" && Number.isFinite(value) ? (value as T) : fallback;
}

export function resolveReceptionistElevenLabsTuning(
  input?: {
    speed?: number | null;
    stability?: number | null;
    similarityBoost?: number | null;
    style?: number | null;
    speakerBoost?: boolean | null;
  } | null,
): ResolvedReceptionistElevenLabsTuning {
  const defaults = DEFAULT_RECEPTIONIST_VOICE_TUNING;
  return {
    speed: clampElevenLabsSpeed(finiteOr(input?.speed, defaults.speed)),
    stability: Math.min(1, Math.max(0, finiteOr(input?.stability, defaults.stability))),
    similarityBoost: Math.min(
      1,
      Math.max(0, finiteOr(input?.similarityBoost, defaults.similarityBoost)),
    ),
    style: Math.min(1, Math.max(0, finiteOr(input?.style, defaults.style))),
    speakerBoost:
      typeof input?.speakerBoost === "boolean" ? input.speakerBoost : defaults.speakerBoost,
  };
}

export function resolveElevenLabsTuningFromVoiceConfig(
  config?: Pick<VoiceAgentConfig, "voiceLanguage" | "advanced"> | null,
): ResolvedReceptionistElevenLabsTuning {
  const voiceLanguage = config?.voiceLanguage;
  const wiz = (config?.advanced as { receptionistWizard?: Record<string, unknown> } | undefined)
    ?.receptionistWizard;
  const compiled = (config?.advanced as { receptionistCompiled?: Record<string, unknown> } | undefined)
    ?.receptionistCompiled;

  return resolveReceptionistElevenLabsTuning({
    speed:
      (wiz?.voiceSpeed as number | undefined) ??
      (compiled?.voiceSpeed as number | undefined) ??
      voiceLanguage?.speed,
    stability:
      (wiz?.elevenLabsStability as number | undefined) ??
      (compiled?.elevenLabsStability as number | undefined) ??
      voiceLanguage?.elevenLabsStability,
    similarityBoost:
      (wiz?.elevenLabsClarity as number | undefined) ??
      (compiled?.elevenLabsSimilarityBoost as number | undefined) ??
      voiceLanguage?.elevenLabsSimilarityBoost,
    style:
      (wiz?.elevenLabsStyle as number | undefined) ??
      (compiled?.elevenLabsStyle as number | undefined) ??
      voiceLanguage?.elevenLabsStyle,
    speakerBoost:
      typeof wiz?.elevenLabsSpeakerBoost === "boolean"
        ? wiz.elevenLabsSpeakerBoost
        : typeof compiled?.elevenLabsSpeakerBoost === "boolean"
          ? compiled.elevenLabsSpeakerBoost
          : voiceLanguage?.elevenLabsSpeakerBoost,
  });
}
