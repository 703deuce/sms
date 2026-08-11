import { inference, stt, tts } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import OpenAI from "openai";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  resolveOutboundRealtimePipelineConfig,
  type OutboundRealtimePipelineConfig,
} from "@/lib/voice/outbound/agent-config";
import {
  getVoicePipelineConfig,
  type VoicePipelineConfig,
} from "@/lib/voice/runtime-provider/config";
import {
  usesDeepSeekPluginLlm,
  usesLiveKitInferenceLlm,
} from "@/lib/voice/runtime-provider/llm-presets";
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

function isDeepSeekThinkingEnabled(): boolean {
  return process.env.VOICE_LLM_THINKING?.trim().toLowerCase() === "enabled";
}

/** Applied to every DeepSeek chat-completions body unless thinking is explicitly enabled. */
export function applyDeepSeekVoiceRequestDefaults(body: Record<string, unknown>): void {
  if (!isDeepSeekThinkingEnabled()) {
    body.thinking = { type: "disabled" };
  }
}

/** DeepSeek V4 defaults to thinking on; disable unless explicitly enabled for voice. */
function createDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for DeepSeek voice LLM");
  }

  const baseOptions = {
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/v1",
    maxRetries: 0,
  };

  if (isDeepSeekThinkingEnabled()) {
    return new OpenAI(baseOptions);
  }

  return new OpenAI({
    ...baseOptions,
    fetch: async (url, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          applyDeepSeekVoiceRequestDefaults(body);
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // leave request unchanged
        }
      }
      return fetch(url, init);
    },
  });
}

export function buildAmyLlm(cfg: VoicePipelineConfig): openai.LLM | inference.LLM {
  if (usesLiveKitInferenceLlm(cfg.llmProvider, cfg.llmModel)) {
    return new inference.LLM({ model: cfg.llmModel });
  }

  if (usesDeepSeekPluginLlm(cfg.llmProvider)) {
    return openai.LLM.withDeepSeek({
      model: cfg.llmModel,
      client: createDeepSeekClient(),
    });
  }

  return new openai.LLM({ model: cfg.llmModel });
}

function describeLlmVia(cfg: VoicePipelineConfig): string {
  if (usesLiveKitInferenceLlm(cfg.llmProvider, cfg.llmModel)) {
    return "livekit_inference";
  }
  if (usesDeepSeekPluginLlm(cfg.llmProvider)) {
    return "deepseek_plugin";
  }
  return "openai_plugin";
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

export function buildOutboundRealtimeModel(config: Pick<VoiceAgentConfig, "advanced">) {
  const realtimeCfg = resolveOutboundRealtimePipelineConfig(config);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI Realtime outbound voice");
  }

  return new openai.realtime.RealtimeModel({
    apiKey,
    model: realtimeCfg.model,
    voice: realtimeCfg.voice,
    modalities: ["audio"],
    inputAudioTranscription: null,
    turnDetection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
    },
    ...(realtimeCfg.reasoning ? { reasoning: realtimeCfg.reasoning } : {}),
  });
}

export function describeRealtimePipelineConfig(
  realtimeCfg: OutboundRealtimePipelineConfig,
) {
  return {
    mode: "openai_realtime",
    model: realtimeCfg.model,
    voice: realtimeCfg.voice,
    reasoning: realtimeCfg.reasoning?.effort || null,
    turnDetection: "server_vad",
    inputAudioTranscription: false,
    via: "openai_plugin_realtime",
  };
}

export function buildAmyVoicePipeline() {
  const cfg = getVoicePipelineConfig();
  const sttCfg = buildAmySttConfig();
  const sttInstance = buildAmyStt(cfg, sttCfg);

  const llm = buildAmyLlm(cfg);

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
      via: describeLlmVia(cfg),
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
