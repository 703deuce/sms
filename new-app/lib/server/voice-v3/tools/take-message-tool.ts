import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { authorizeTakeMessageOrError } from "./authorize-tool-for-config";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";
import { TAKE_MESSAGE_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const takeMessageArgsSchema = z.object({
  message: z
    .string()
    .min(1)
    .describe(
      "The caller's message for staff — factual summary of what they want the business to know or act on. Do not invent content.",
    ),
  callback_phone: z
    .string()
    .nullable()
    .describe(
      "Phone number for follow-up if different from inbound line or stored shared phone; null when ANI or stored phone is sufficient.",
    ),
  caller_name: z
    .string()
    .nullable()
    .describe("Caller name if known and not already in shared intake; otherwise null."),
});

export type TakeMessageArgs = z.infer<typeof takeMessageArgsSchema>;

export function buildTakeMessageOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "take_message",
    parameters: takeMessageArgsSchema,
    description: TAKE_MESSAGE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const takeMessageTool: VoiceToolDefinition<TakeMessageArgs> = {
  name: "take_message",
  description: "take_message",
  parameters: {},
  validate: (raw) => takeMessageArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeTakeMessageOrError(config);
    if (denied) return denied;

    let snap = mergeDialogActiveGoalFromOperation(ctx.runtime.getSnapshot(), "take_message");
    ctx.runtime.replaceContext(snap);
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { executeTakeMessage } = await import("../callback/execute-take-message");
    const { result, nextContext } = await executeTakeMessage({
      workspaceId,
      agentId: config.agentId ?? null,
      config,
      context: snap,
      args,
    });
    ctx.runtime.replaceContext(nextContext);
    return result;
  },
};
