import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { TRANSFER_CALL_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const transferArgsSchema = z.object({
  destination: z
    .string()
    .nullable()
    .describe(
      "Configured transfer destination identifier (e.g. front_desk). Null when only one destination is configured. Never invent a number or destination.",
    ),
  reason: z.string().nullable().describe("Brief internal reason for transfer. Null if none."),
});

export function buildTransferCallOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "transfer_call",
    parameters: transferArgsSchema,
    description: TRANSFER_CALL_TOOL_DESCRIPTION,
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
    let destination = process.env.VOICE_V3_TRANSFER_DESTINATION?.trim() || null;
    const mapRaw = process.env.VOICE_V3_TRANSFER_DESTINATIONS?.trim();
    if (args.destination?.trim() && mapRaw) {
      try {
        const map = JSON.parse(mapRaw) as Record<string, string>;
        destination = map[args.destination.trim()] ?? destination;
      } catch {
        /* ignore */
      }
    }
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
