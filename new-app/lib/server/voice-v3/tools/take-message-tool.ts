import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { authorizeTakeMessageOrError } from "./authorize-tool-for-config";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";

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

const TAKE_MESSAGE_DESCRIPTION = `take_message — record a message for the business team when the caller wants to leave information without scheduling or an immediate transfer.

Use when the caller asks to leave a message, pass along details, or wants staff to follow up on information they provided (not necessarily a return phone call — use request_callback when they explicitly want a call back).

Provide message with the substance of what they said. Include callback_phone only when a different number is needed for follow-up.`;

export function buildTakeMessageOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "take_message",
    parameters: takeMessageArgsSchema,
    description: TAKE_MESSAGE_DESCRIPTION,
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
