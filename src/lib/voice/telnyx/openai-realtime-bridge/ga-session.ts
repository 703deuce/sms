import { OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";
import type { OpenAiRealtimeFunctionTool } from "./realtime-tools";

/** OpenAI Realtime GA session.update payload (no OpenAI-Beta header). */
export function buildOpenAiRealtimeGaSessionUpdate(input: {
  instructions: string;
  tools: OpenAiRealtimeFunctionTool[];
}): Record<string, unknown> {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      instructions: input.instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: { type: "server_vad" },
        },
        output: {
          format: { type: "audio/pcmu" },
          voice: OPENAI_REALTIME_BRIDGE_VOICE,
        },
      },
      tools: input.tools.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      tool_choice: "auto",
    },
  };
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
