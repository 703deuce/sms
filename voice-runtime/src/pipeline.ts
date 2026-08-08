import { inference, tts } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import {
  getVoicePipelineConfig,
  type VoicePipelineConfig,
} from "@/lib/voice/runtime-provider/config";

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
  return `${prefix}/${trimmed}`;
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

  let ttsInstance: tts.TTS;
  if (cfg.ttsProvider === "elevenlabs-plugin") {
    ttsInstance = new elevenlabs.TTS({
      model: cfg.ttsModel as elevenlabs.TTSModels,
      voiceId: cfg.ttsVoice || process.env.VOICE_TTS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
    });
  } else if (cfg.ttsProvider === "inference" || cfg.ttsProvider === "inworld" || cfg.ttsProvider === "elevenlabs") {
    const ttsModel =
      cfg.ttsProvider === "inference"
        ? cfg.ttsModel
        : normalizeInferenceModel(cfg.ttsProvider, cfg.ttsModel, "inworld");
    ttsInstance = new inference.TTS({
      model: ttsModel,
      voice: cfg.ttsVoice || "Ashley",
      language: cfg.ttsLanguage,
    });
  } else {
    ttsInstance = new inference.TTS({
      model: "inworld/inworld-tts-1.5-mini",
      voice: cfg.ttsVoice || "Ashley",
      language: cfg.ttsLanguage,
    });
  }

  return { stt, llm, tts: ttsInstance, config: cfg };
}

export function describePipelineConfig(cfg: VoicePipelineConfig) {
  return {
    stt: { provider: cfg.sttProvider, model: cfg.sttModel, language: cfg.sttLanguage },
    llm: { provider: cfg.llmProvider, model: cfg.llmModel },
    tts: {
      provider: cfg.ttsProvider,
      model: cfg.ttsModel,
      voice: cfg.ttsVoice,
      language: cfg.ttsLanguage,
    },
  };
}
