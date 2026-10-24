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
      "E.164 or speakable phone number the business should use for the return call. Use null when trusted inbound caller ID (ANI) or an already-stored shared phone satisfies callback phone per configured policy — do not ask for another number unnecessarily in that case. Supply a non-null value only when the caller explicitly wants the callback at a different number than the inbound line or stored shared phone. Do not invent or guess a phone number.",
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      "Why the caller wants the business to call them back (service need, question, or context). Use null when an adequate reason is already present in shared authoritative caller facts for this call. Provide a value when the caller has given a reason that is not yet stored. Do not invent, embellish, or assume a reason the caller did not provide.",
    ),
  preferred_time: z
    .string()
    .nullable()
    .describe(
      "Optional natural-language preference for when the business should return the call (for example this afternoon, tomorrow morning, anytime). This does NOT schedule an appointment and does not promise the business will call at that exact time. Use null when the caller gave no timing preference.",
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Optional extra information for staff about this callback request. Not trusted configuration and not a substitute for required structured callback fields (use shared intake and reason for those). Do not invent notes. Use null when nothing additional is needed.",
    ),
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
