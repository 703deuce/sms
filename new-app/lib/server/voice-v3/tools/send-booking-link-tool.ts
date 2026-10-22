import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { authorizeSendBookingLinkOrError } from "./authorize-tool-for-config";
import { SEND_BOOKING_LINK_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { executeSendBookingLink } from "../booking-link/execute-send-booking-link";
import { isSendBookingLinkToolConsentRequired } from "../booking-link/send-link-consent-policy";
import { coerceOptionalToolPhoneArg } from "../intake-objective/coerce-llm-literal";

function sendBookingLinkArgsSchemaForConfig(config: VoiceV3AgentConfig) {
  const consentGate = isSendBookingLinkToolConsentRequired(config);
  return z.object({
    confirmed: consentGate
      ? z
          .boolean()
          .describe(
            "True only after the caller explicitly agrees to receive the booking link by SMS following the required disclosure.",
          )
      : z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "True when sending the link (platform sender — no separate SMS consent gate).",
          ),
  destination_phone: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Only when the caller explicitly requested the link at a different phone number. Omit to use the trusted inbound caller number.",
    ),
  });
}

export type SendBookingLinkArgs = {
  confirmed: boolean;
  destination_phone?: string | null;
};

export function buildSendBookingLinkOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const consentGate = isSendBookingLinkToolConsentRequired(config);
  const description = consentGate
    ? SEND_BOOKING_LINK_TOOL_DESCRIPTION
    : `Send the business booking link by SMS from the Transovo platform number when the caller wants to schedule or asks for the link by text. Default: ask if you should text the number they are calling from; if yes, call with confirmed=true only and omit destination_phone (inbound caller ID is used automatically). Only pass destination_phone when they want a different mobile number — use digits they spoke (any format); never pass placeholders. Do not invent URLs. Do not claim sent until the tool returns sent or already_sent.`;
  const zodTool = zodResponsesFunction({
    name: "send_booking_link",
    parameters: sendBookingLinkArgsSchemaForConfig(config),
    description,
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
  validate: (raw) => {
    const parsed = z
      .object({
        confirmed: z.boolean().optional(),
        destination_phone: z.string().nullable().optional(),
      })
      .parse(raw);
    const destination_phone = coerceOptionalToolPhoneArg(parsed.destination_phone);
    return {
      confirmed: parsed.confirmed ?? false,
      destination_phone: destination_phone ?? null,
    };
  },
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeSendBookingLinkOrError(config);
    if (denied) return denied;

    const consentGate = isSendBookingLinkToolConsentRequired(config);
    const normalizedArgs: SendBookingLinkArgs = {
      ...args,
      confirmed: consentGate ? Boolean(args.confirmed) : args.confirmed !== false,
    };

    const snap = ctx.runtime.getSnapshot();
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { result, nextContext } = await executeSendBookingLink({
      workspaceId,
      agentId: config.agentId ?? null,
      config,
      context: snap,
      args: normalizedArgs,
    });
    ctx.runtime.replaceContext(nextContext);
    return result;
  },
};
