import type { SessionAcceptParams } from "openai/resources/live/sessions";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "@/lib/voice-v3/prompts/build-voice-v3-prompts";

export const VOICE_V3_BASIC_LIVE_MODEL = "gpt-live-1";
export const VOICE_V3_BASIC_BACKEND_MODEL = "gpt-6-astra";

let configLogged = false;

export function logVoiceV3BasicConfigOnce(): void {
  if (configLogged) return;
  configLogged = true;
  console.log("VOICE_V3_BASIC_CONFIG", {
    frontend: VOICE_V3_BASIC_LIVE_MODEL,
    backend: VOICE_V3_BASIC_BACKEND_MODEL,
  });
}

/**
 * SIP accept configuration: no audio.format (negotiated by SIP).
 * Native Responses delegation to GPT-6 Astra — no separate Astra loop.
 * Prompts: src/lib/voice-v3/prompts/* (SDK SessionAcceptParams.Session).
 * Architecture: docs/voice-v3/OPENAI-NATIVE-FIRST-ARCHITECTURE.md
 */
export function buildBasicLiveSession(at: Date = new Date()): SessionAcceptParams.Session {
  logVoiceV3BasicConfigOnce();
  const prompts = buildVoiceV3Prompts(resolveVoiceV3DefaultPromptInput(at));

  return {
    type: "live",
    model: VOICE_V3_BASIC_LIVE_MODEL,
    instructions: prompts.liveInstructions,
    audio: {
      output: {
        voice: "marin",
      },
    },
    delegation: {
      type: "responses",
      responses: {
        model: VOICE_V3_BASIC_BACKEND_MODEL,
        instructions: prompts.astraInstructions,
        reasoning: {
          effort: "low",
        },
        text: {
          verbosity: "low",
        },
        parallel_tool_calls: false,
        tool_choice: "auto",
        max_output_tokens: 200,
        tools: [],
      },
    },
  };
}

export function buildBasicLiveSessionAcceptParams(at: Date = new Date()): SessionAcceptParams {
  return { session: buildBasicLiveSession(at) };
}
