import { getResolvedTurnPreset, isFluxEagerPreset } from "./turn-config";

export type AmySttConfig = {
  model: string;
  language: string;
  modelOptions?: {
    eager_eot_threshold?: number;
    eot_threshold?: number;
    eot_timeout_ms?: number;
  };
  mode: "nova" | "flux";
};

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** Resolve STT model + Flux EOT knobs from turn preset and env. */
export function buildAmySttConfig(): AmySttConfig {
  const preset = getResolvedTurnPreset();
  const language = process.env.VOICE_STT_LANGUAGE?.trim() || "en";

  if (isFluxEagerPreset(preset)) {
    const model =
      process.env.VOICE_STT_MODEL?.trim() || "deepgram/flux-general-en";
    return {
      model,
      language,
      mode: "flux",
      modelOptions: {
        eager_eot_threshold: readFloatEnv("VOICE_FLUX_EAGER_EOT_THRESHOLD", 0.3),
        eot_threshold: readFloatEnv("VOICE_FLUX_EOT_THRESHOLD", 0.7),
        eot_timeout_ms: readIntEnv("VOICE_FLUX_EOT_TIMEOUT_MS", 5000),
      },
    };
  }

  return {
    model: process.env.VOICE_STT_MODEL?.trim() || "deepgram/nova-3",
    language,
    mode: "nova",
  };
}

export function describeAmySttConfig(cfg: AmySttConfig): Record<string, unknown> {
  return {
    mode: cfg.mode,
    model: cfg.model,
    language: cfg.language,
    ...(cfg.modelOptions
      ? {
          fluxEot: {
            eagerEotThreshold: cfg.modelOptions.eager_eot_threshold,
            eotThreshold: cfg.modelOptions.eot_threshold,
            eotTimeoutMs: cfg.modelOptions.eot_timeout_ms,
          },
        }
      : {}),
  };
}
