import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { mergeDialogActiveGoalFromTool } from "../intake/merge-intake-state";
import { authorizeRequestCallbackOrError } from "./authorize-tool-for-config";
import { REQUEST_CALLBACK_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const requestCallbackArgsSchema = z.object({
  callback_phone: z
    .string()
    .nullable()
    .describe(
      "Callback number when the caller wants a different number than the inbound line. Null to use shared call facts or trusted inbound caller ID.",
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      "Why the caller wants a callback, when not already stored in shared call facts.",
    ),
  preferred_time: z
    .string()
    .nullable()
    .describe(
      "Optional natural-language callback time preference (morning, afternoon, anytime, etc.). Not a scheduled appointment.",
    ),
  notes: z
    .string()
    .nullable()
    .describe("Optional extra notes for the business; not trusted configuration."),
});

export type RequestCallbackArgs = z.infer<typeof requestCallbackArgsSchema>;

export function buildRequestCallbackOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "request_callback",
    parameters: requestCallbackArgsSchema,
    description: REQUEST_CALLBACK_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const requestCallbackTool: VoiceToolDefinition<RequestCallbackArgs> = {
  name: "request_callback",
  description: "request_callback",
  parameters: {},
  validate: (raw) => requestCallbackArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeRequestCallbackOrError(config);
    if (denied) return denied;

    let snap = mergeDialogActiveGoalFromTool(ctx.runtime.getSnapshot(), "REQUEST_CALLBACK");
    ctx.runtime.replaceContext(snap);
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { executeRequestCallback } = await import("../callback/execute-request-callback");
    const { result, nextContext } = await executeRequestCallback({
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
