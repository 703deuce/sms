import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { TRANSFER_CALL_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { authorizeVoiceV3ToolOrError } from "./authorize-tool-for-config";

function buildTransferArgsSchema(config: VoiceV3AgentConfig) {
  const ids = config.transferDestinations?.map((d) => d.id).filter(Boolean) ?? [];
  const destinationSchema =
    ids.length > 0
      ? z
          .enum(ids as [string, ...string[]])
          .nullable()
          .describe(
            `Configured transfer destination id. Allowed: ${ids.join(", ")}. Null when only one destination applies.`,
          )
      : z
          .string()
          .nullable()
          .describe(
            "Configured transfer destination identifier (e.g. front_desk). Null when only one destination is configured. Never invent a number or destination.",
          );

  return z.object({
    destination: destinationSchema,
    reason: z.string().nullable().describe("Brief internal reason for transfer. Null if none."),
  });
}

const looseTransferArgsSchema = z.object({
  destination: z.string().nullable(),
  reason: z.string().nullable(),
});

export function buildTransferCallOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "transfer_call",
    parameters: buildTransferArgsSchema(config),
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

export const transferCallTool: VoiceToolDefinition<{
  destination?: string | null;
  reason?: string | null;
}> = {
  name: "transfer_call",
  description: "transfer_call",
  parameters: {},
  validate: (raw) => looseTransferArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeVoiceV3ToolOrError(config, "transfer_call");
    if (denied) return denied;
    const strict = buildTransferArgsSchema(config).safeParse(args);
    if (!strict.success) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Transfer arguments are invalid.",
        { issues: strict.error.issues.map((i) => i.message) },
      );
    }
    const parsed = strict.data;

    let destination = process.env.VOICE_V3_TRANSFER_DESTINATION?.trim() || null;
    const mapRaw = process.env.VOICE_V3_TRANSFER_DESTINATIONS?.trim();
    const destId = parsed.destination?.trim();

    if (destId && config.transferDestinations?.length) {
      const row = config.transferDestinations.find((d) => d.id === destId);
      if (!row) {
        return voiceToolError(
          "INVALID_DESTINATION",
          "Transfer destination is not configured.",
          { destination: destId },
          "error",
        );
      }
      const configured = row.phoneE164?.trim();
      if (configured) {
        destination = configured;
      }
    }

    if (destId && mapRaw && !destination) {
      try {
        const map = JSON.parse(mapRaw) as Record<string, string>;
        destination = map[destId] ?? destination;
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
      reason: parsed.reason ?? null,
      destination,
      destination_id: destId ?? null,
    });
    return toolOk("transfer_requested", {
      destination,
      destination_id: destId ?? null,
      note: "LiveKit worker performs SIP transfer after authorization.",
    });
  },
};
