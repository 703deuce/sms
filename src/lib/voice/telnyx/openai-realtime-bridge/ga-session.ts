import { OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";
import type { OpenAiRealtimeFunctionTool } from "./realtime-tools";

export const OPENAI_REALTIME_MINIMAL_AMY_INSTRUCTIONS =
  "You are Amy. Respond briefly and conversationally.";

function gaAudioSessionBlock(): Record<string, unknown> {
  return {
    input: {
      format: { type: "audio/pcmu" },
      turn_detection: { type: "server_vad" },
    },
    output: {
      format: { type: "audio/pcmu" },
      voice: OPENAI_REALTIME_BRIDGE_VOICE,
    },
  };
}

/** Smallest GA session: no tools, short instructions — for Test A handshake. */
export function buildOpenAiRealtimeGaMinimalSessionUpdate(
  instructions = OPENAI_REALTIME_MINIMAL_AMY_INSTRUCTIONS,
): Record<string, unknown> {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      instructions,
      output_modalities: ["audio"],
      audio: gaAudioSessionBlock(),
    },
  };
}

/** OpenAI Realtime GA session.update payload (no OpenAI-Beta header). */
export function buildOpenAiRealtimeGaSessionUpdate(input: {
  instructions: string;
  tools?: OpenAiRealtimeFunctionTool[];
}): Record<string, unknown> {
  const tools = input.tools ?? [];
  const session: Record<string, unknown> = {
    type: "realtime",
    instructions: input.instructions,
    output_modalities: ["audio"],
    audio: gaAudioSessionBlock(),
  };
  if (tools.length > 0) {
    session.tools = tools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    session.tool_choice = "auto";
  }
  return { type: "session.update", session };
}

export function buildOpenAiRealtimeGaGreetingResponse(instructions: string): Record<string, unknown> {
  return {
    type: "response.create",
    response: {
      output_modalities: ["audio"],
      instructions,
    },
  };
}
