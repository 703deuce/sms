import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

const transferArgsSchema = z.object({
  reason: z.string().nullable(),
});

export function buildTransferCallOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "transfer_call",
    parameters: transferArgsSchema,
    description:
      "Transfer the live call to a human when the caller needs a person and policy allows. Does not transfer until tool result confirms success.",
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const transferCallTool: VoiceToolDefinition<{ reason?: string | null }> = {
  name: "transfer_call",
  description: "transfer_call",
  parameters: {},
  validate: (raw) => transferArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const destination = process.env.VOICE_V3_TRANSFER_DESTINATION?.trim();
    if (!destination) {
      return voiceToolError(
        "TRANSFER_NOT_CONFIGURED",
        "Human transfer destination is not configured for this workspace.",
        {},
        "not_ready",
      );
    }
    console.log("VOICE_TRANSFER_REQUESTED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      reason: args.reason ?? null,
      destination,
    });
    return toolOk("transfer_requested", {
      destination,
      note: "Telnyx transfer must be executed by voice transport integration.",
    });
  },
};
