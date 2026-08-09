import { inference, stt, tts } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import {
  getVoicePipelineConfig,
  type VoicePipelineConfig,
} from "@/lib/voice/runtime-provider/config";
import { usesLiveKitInferenceLlm } from "@/lib/voice/runtime-provider/llm-presets";
import { buildAmySttConfig, describeAmySttConfig, type AmySttConfig } from "./stt-config";
import { resolveElevenLabsApiKey } from "./env-aliases";

const INFERENCE_TTS_PROVIDERS = new Set([
  "inference",
  "cartesia",
  "rime",
  "inworld",
  "elevenlabs",
  "deepgram",
]);

function normalizeInferenceModel(
  provider: string,
  model: string,
  prefix: string,
): string {
  const trimmed = model.trim();
  if (trimmed.includes("/")) return trimmed;
  if (provider === "deepgram") return `deepgram/${trimmed}`;
  if (provider === "inworld") return `inworld/${trimmed}`;
  if (provider === "elevenlabs") return `elevenlabs/${trimmed}`;
  if (provider === "cartesia") return `cartesia/${trimmed}`;
  if (provider === "rime") return `rime/${trimmed}`;
  return `${prefix}/${trimmed}`;
}

function resolveInferenceTtsModel(cfg: VoicePipelineConfig): string {
  if (cfg.ttsModel.includes("/")) return cfg.ttsModel;
  return normalizeInferenceModel(cfg.ttsProvider, cfg.ttsModel, "inworld");
}

/** Plugin APIs use bare model ids (e.g. nova-3), not inference paths (deepgram/nova-3). */
function stripProviderPrefix(model: string, prefix: string): string {
  const trimmed = model.trim();
  const needle = `${prefix}/`;
  return trimmed.startsWith(needle) ? trimmed.slice(needle.length) : trimmed;
}

function resolveDeepgramPluginModel(model: string): string {
  return stripProviderPrefix(model, "deepgram");
}

function resolveElevenLabsPluginModel(model: string): string {
  return stripProviderPrefix(model, "elevenlabs");
}

function isFluxDeepgramModel(model: string): boolean {
  return resolveDeepgramPluginModel(model).startsWith("flux-");
}

export function resolveDeepgramSttApi(
  sttCfg: AmySttConfig,
): "flux_v2" | "nova_v1" | "inference" {
  if (sttCfg.mode === "flux" || isFluxDeepgramModel(sttCfg.model)) return "flux_v2";
  return "nova_v1";
}

export function usesDeepgramPluginStt(provider: string): boolean {
  const normalized = provider.trim().toLowerCase();
  return normalized === "deepgram-plugin" || normalized === "deepgram";
}

export function usesElevenLabsPluginTts(provider: string): boolean {
  return provider.trim().toLowerCase() === "elevenlabs-plugin";
}

export function buildAmyStt(
  cfg: VoicePipelineConfig,
  sttCfg: AmySttConfig,
): stt.STT {
  if (usesDeepgramPluginStt(cfg.sttProvider)) {
    const model = resolveDeepgramPluginModel(sttCfg.model);
    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();

    if (resolveDeepgramSttApi(sttCfg) === "flux_v2") {
      return new deepgram.STTv2({
        model,
        language: sttCfg.language,
        apiKey,
        eagerEotThreshold: sttCfg.modelOptions?.eager_eot_threshold,
        eotThreshold: sttCfg.modelOptions?.eot_threshold,
        eotTimeoutMs: sttCfg.modelOptions?.eot_timeout_ms,
      });
    }

    return new deepgram.STT({
      model: model as deepgram.STTModels,
      language: sttCfg.language,
      apiKey,
      interimResults: true,
      punctuate: true,
      smartFormat: true,
      noDelay: true,
    });
  }

  const sttModel =
    cfg.sttProvider === "inference"
      ? sttCfg.model
      : normalizeInferenceModel(cfg.sttProvider, sttCfg.model, "deepgram");

  return new inference.STT({
    model: sttModel,
    language: sttCfg.language,
    ...(sttCfg.modelOptions ? { modelOptions: sttCfg.modelOptions } : {}),
  });
}

export function buildAmyTts(cfg: VoicePipelineConfig): tts.TTS {
  if (usesElevenLabsPluginTts(cfg.ttsProvider)) {
    return new elevenlabs.TTS({
      apiKey: resolveElevenLabsApiKey(),
      model: resolveElevenLabsPluginModel(cfg.ttsModel) as elevenlabs.TTSModels,
      voiceId: cfg.ttsVoice || process.env.VOICE_TTS_VOICE_ID || "cgSgspJ2msm6clMCkdW9",
    });
  }

  if (INFERENCE_TTS_PROVIDERS.has(cfg.ttsProvider)) {
    const model = resolveInferenceTtsModel(cfg);
    return new inference.TTS({
      model,
      voice: cfg.ttsVoice,
      language: cfg.ttsLanguage,
    });
  }

  return new inference.TTS({
    model: "elevenlabs/eleven_flash_v2_5",
    voice: cfg.ttsVoice || "cgSgspJ2msm6clMCkdW9",
    language: cfg.ttsLanguage,
  });
}

export function buildAmyVoicePipeline() {
  const cfg = getVoicePipelineConfig();
  const sttCfg = buildAmySttConfig();
  const sttInstance = buildAmyStt(cfg, sttCfg);

  const llm = usesLiveKitInferenceLlm(cfg.llmProvider, cfg.llmModel)
    ? new inference.LLM({ model: cfg.llmModel })
    : new openai.LLM({ model: cfg.llmModel });

  const ttsInstance = buildAmyTts(cfg);

  return { stt: sttInstance, llm, tts: ttsInstance, config: cfg, sttConfig: sttCfg };
}

export function describePipelineConfig(
  cfg: VoicePipelineConfig,
  sttConfig = buildAmySttConfig(),
) {
  return {
    stt: {
      ...describeAmySttConfig(sttConfig),
      provider: cfg.sttProvider,
      via: usesDeepgramPluginStt(cfg.sttProvider)
        ? resolveDeepgramSttApi(sttConfig) === "flux_v2"
          ? "deepgram_plugin_flux"
          : "deepgram_plugin"
        : "livekit_inference",
    },
    llm: {
      provider: cfg.llmProvider,
      model: cfg.llmModel,
      preset: cfg.llmPreset || null,
      via: usesLiveKitInferenceLlm(cfg.llmProvider, cfg.llmModel)
        ? "livekit_inference"
        : "openai_plugin",
    },
    tts: {
      preset: cfg.ttsPreset || null,
      provider: cfg.ttsProvider,
      model: cfg.ttsModel,
      voice: cfg.ttsVoice,
      language: cfg.ttsLanguage,
      via: usesElevenLabsPluginTts(cfg.ttsProvider) ? "elevenlabs_plugin" : "livekit_inference",
    },
  };
}
