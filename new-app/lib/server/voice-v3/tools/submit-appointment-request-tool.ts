import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

const submitAppointmentRequestSchema = z.object({
  preferred_time: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type SubmitAppointmentRequestToolArgs = z.infer<typeof submitAppointmentRequestSchema>;

export function buildSubmitAppointmentRequestOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "submit_appointment_request",
    parameters: submitAppointmentRequestSchema,
    description:
      "Submit a staff-reviewed appointment request when live calendar booking is not enabled. Collect required intake first; do not promise a confirmed time.",
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const submitAppointmentRequestTool: VoiceToolDefinition<SubmitAppointmentRequestToolArgs> = {
  name: "submit_appointment_request",
  description: "submit_appointment_request",
  parameters: {},
  validate: (raw) => submitAppointmentRequestSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    if (config.scheduling?.bookingStrategy !== "REQUEST_ONLY") {
      return voiceToolError(
        "BOOKING_STRATEGY_MISMATCH",
        "submit_appointment_request is not available for this booking strategy.",
        {},
        "not_allowed",
      );
    }
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { executeSubmitAppointmentRequest } = await import(
      "../appointment-request/execute-submit-appointment-request"
    );
    const { result, nextContext } = await executeSubmitAppointmentRequest({
      workspaceId,
      agentId: config.agentId ?? null,
      config,
      context: ctx.runtime.getSnapshot(),
      args,
    });
    ctx.runtime.replaceContext(nextContext);
    return result;
  },
};
