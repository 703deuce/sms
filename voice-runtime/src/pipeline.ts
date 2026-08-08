import { inference } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import { getVoicePipelineConfig } from "@/lib/voice/runtime-provider/config";

export function buildAmyVoicePipeline() {
  const cfg = getVoicePipelineConfig();

  const stt =
    cfg.sttProvider === "deepgram"
      ? new inference.STT({ model: `deepgram/${cfg.sttModel}`, language: "en" })
      : new inference.STT({ model: "deepgram/nova-3", language: "en" });

  let llm: openai.LLM | inference.LLM;
  if (cfg.llmProvider === "openai") {
    llm = new openai.LLM({ model: cfg.llmModel });
  } else {
    llm = new inference.LLM({ model: cfg.llmModel });
  }

  let tts: elevenlabs.TTS | inference.TTS;
  if (cfg.ttsProvider === "elevenlabs") {
    tts = new elevenlabs.TTS({
      model: cfg.ttsModel as elevenlabs.TTSModels,
      voiceId: cfg.ttsVoice || process.env.VOICE_TTS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
    });
  } else if (cfg.ttsProvider === "inworld") {
    tts = new inference.TTS({
      model: "inworld/inworld-tts-2",
      voice: cfg.ttsVoice || "Ashley",
    });
  } else {
    tts = new inference.TTS({
      model: "inworld/inworld-tts-2",
      voice: cfg.ttsVoice || "Ashley",
    });
  }

  return { stt, llm, tts, config: cfg };
}
