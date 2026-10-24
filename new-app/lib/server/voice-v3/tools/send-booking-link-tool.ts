import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { authorizeSendBookingLinkOrError } from "./authorize-tool-for-config";
import { SEND_BOOKING_LINK_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { executeSendBookingLink } from "../booking-link/execute-send-booking-link";

const sendBookingLinkArgsSchema = z.object({
  confirmed: z
    .boolean()
    .describe(
      "True only after the caller explicitly agrees to receive the booking link by SMS following the required disclosure.",
    ),
  destination_phone: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Only when the caller explicitly requested the link at a different phone number. Omit to use the trusted inbound caller number.",
    ),
});

export type SendBookingLinkArgs = z.infer<typeof sendBookingLinkArgsSchema>;

export function buildSendBookingLinkOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "send_booking_link",
    parameters: sendBookingLinkArgsSchema,
    description: SEND_BOOKING_LINK_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const sendBookingLinkTool: VoiceToolDefinition<SendBookingLinkArgs> = {
  name: "send_booking_link",
  description: "send_booking_link",
  parameters: {},
  validate: (raw) => sendBookingLinkArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeSendBookingLinkOrError(config);
    if (denied) return denied;

    const snap = ctx.runtime.getSnapshot();
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { result, nextContext } = await executeSendBookingLink({
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
