import { inference, tts } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import {
  getVoicePipelineConfig,
  type VoicePipelineConfig,
} from "@/lib/voice/runtime-provider/config";

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

export function buildAmyTts(cfg: VoicePipelineConfig): tts.TTS {
  if (cfg.ttsProvider === "elevenlabs-plugin") {
    return new elevenlabs.TTS({
      model: cfg.ttsModel as elevenlabs.TTSModels,
      voiceId: cfg.ttsVoice || process.env.VOICE_TTS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
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
    voice: cfg.ttsVoice || "21m00Tcm4TlvDq8ikWAM",
    language: cfg.ttsLanguage,
  });
}

export function buildAmyVoicePipeline() {
  const cfg = getVoicePipelineConfig();

  const sttModel =
    cfg.sttProvider === "inference"
      ? cfg.sttModel
      : normalizeInferenceModel(cfg.sttProvider, cfg.sttModel, "deepgram");

  const stt = new inference.STT({
    model: sttModel,
    language: cfg.sttLanguage,
  });

  let llm: openai.LLM | inference.LLM;
  if (cfg.llmProvider === "openai") {
    llm = new openai.LLM({ model: cfg.llmModel });
  } else {
    llm = new inference.LLM({ model: cfg.llmModel });
  }

  const ttsInstance = buildAmyTts(cfg);

  return { stt, llm, tts: ttsInstance, config: cfg };
}

export function describePipelineConfig(cfg: VoicePipelineConfig) {
  return {
    stt: { provider: cfg.sttProvider, model: cfg.sttModel, language: cfg.sttLanguage },
    llm: { provider: cfg.llmProvider, model: cfg.llmModel },
    tts: {
      preset: cfg.ttsPreset || null,
      provider: cfg.ttsProvider,
      model: cfg.ttsModel,
      voice: cfg.ttsVoice,
      language: cfg.ttsLanguage,
    },
  };
}
