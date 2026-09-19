import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { findExistingAppointment } from "../calendar/find-existing-appointment";
import { applyVerifiedExisting } from "../calendar/appointment-management-dispatch";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { FIND_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const findApptArgsSchema = z.object({
  phone: z
    .string()
    .nullable()
    .describe("Caller phone when explicitly provided. Null to use intake phone already saved."),
  email: z
    .string()
    .nullable()
    .describe("Caller email when explicitly provided. Null to use intake email already saved."),
  date_expression: z
    .string()
    .nullable()
    .describe(
      "Known or approximate date of the existing appointment if the caller supplied one (natural language or YYYY-MM-DD). Null if unknown.",
    ),
});

export type FindAppointmentArgs = z.infer<typeof findApptArgsSchema>;

export function buildFindAppointmentOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "find_appointment",
    parameters: findApptArgsSchema,
    description: FIND_APPOINTMENT_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const findAppointmentTool: VoiceToolDefinition<FindAppointmentArgs> = {
  name: "find_appointment",
  description: "find_appointment",
  parameters: {},
  validate: (raw) => findApptArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const snap = ctx.runtime.getSnapshot();
    const phone = args.phone?.trim() || snap.intake.values.phone?.value?.trim() || undefined;
    const email = args.email?.trim() || snap.intake.values.email?.value?.trim() || undefined;
    if (!phone && !email) {
      return voiceToolError(
        "MISSING_PHONE_OR_EMAIL",
        "Need phone or email to find an existing appointment.",
        { missing: ["phone", "email"] },
        "not_ready",
      );
    }

    const result = findExistingAppointment({
      callId: snap.callId,
      phone,
      email,
      customerName: snap.intake.values.name?.value,
      dateHint: args.date_expression?.trim()
        ? { localDate: args.date_expression.trim() }
        : snap.scheduling.normalized,
    });

    if (result.status === "VERIFICATION_FAILED") {
      return voiceToolError("VERIFICATION_FAILED", "Could not verify caller for appointment lookup.", {
        reason: result.reason,
      });
    }
    if (result.status === "NONE") {
      return voiceToolError("APPOINTMENT_NOT_FOUND", "No matching appointment found.", {}, "not_found");
    }
    if (result.status === "MULTIPLE") {
      return toolOk("ambiguous", {
        appointments: result.candidateSet.candidates.map((c) => ({
          candidate_id: c.candidateId,
          display_time: c.appointment.localStart,
          provider_event_id: c.appointment.providerEventId,
        })),
      });
    }

    ctx.runtime.replaceContext(applyVerifiedExisting(snap, result.appointment));
    return toolOk("found", {
      provider_event_id: result.appointment.providerEventId,
      display_time: result.appointment.localStart,
      local_start: result.appointment.localStart,
    });
  },
};
