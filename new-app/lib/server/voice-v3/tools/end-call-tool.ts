import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk } from "./types";
import { END_CALL_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const endArgsSchema = z.object({
  reason: z
    .string()
    .nullable()
    .describe("Brief reason the conversation is complete. Null if none."),
});

export function buildEndCallOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "end_call",
    parameters: endArgsSchema,
    description: END_CALL_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const endCallTool: VoiceToolDefinition<{ reason?: string | null }> = {
  name: "end_call",
  description: "end_call",
  parameters: {},
  validate: (raw) => endArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    console.log("VOICE_END_CALL_REQUESTED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      reason: args.reason ?? null,
    });
    return toolOk("end_requested", {
      note: "Live owns goodbye speech; transport may hang up when session ends.",
    });
  },
};
