import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  appointmentSelectionId,
  buildSingleAppointmentCandidateSet,
  findExistingAppointment,
  nextLookupStateFromResult,
  resolveVerifiedAppointmentBySelectionId,
} from "../calendar/find-existing-appointment";
import { applyVerifiedExisting } from "../calendar/appointment-management-dispatch";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { FIND_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const findApptArgsSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Caller or appointment holder name when explicitly provided. Null to use intake name already saved.",
    ),
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
  service: z
    .string()
    .nullable()
    .describe("Service or reason for the appointment when the caller mentioned it. Null if unknown."),
  location: z
    .string()
    .nullable()
    .describe(
      "Service address or location on the appointment when the caller mentioned it. Null if unknown.",
    ),
  appointment_selection_id: z
    .string()
    .nullable()
    .describe(
      "Opaque selection_id from a prior find_appointment candidates or needs_confirmation result. Never a Microsoft Graph event id.",
    ),
  confirm_selection: z
    .boolean()
    .describe(
      "True only after the caller clearly confirmed this is the exact appointment they mean. False when still identifying.",
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

function mergeFindArgs(ctx: VoiceV3CallContext, args: FindAppointmentArgs) {
  const snap = ctx;
  return {
    name: args.name?.trim() || snap.intake.values.name?.value?.trim() || undefined,
    phone: args.phone?.trim() || snap.intake.values.phone?.value?.trim() || undefined,
    email: args.email?.trim() || snap.intake.values.email?.value?.trim() || undefined,
    dateExpression: args.date_expression?.trim() || null,
    service: args.service?.trim() || undefined,
    location: args.location?.trim() || undefined,
  };
}

export const findAppointmentTool: VoiceToolDefinition<FindAppointmentArgs> = {
  name: "find_appointment",
  description: "find_appointment",
  parameters: {},
  validate: (raw) => findApptArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const snap = ctx.runtime.getSnapshot();
    const merged = mergeFindArgs(snap, args);
    const lookupState = snap.appointmentManagement.lookupState;

    if (args.confirm_selection) {
      const selected = resolveVerifiedAppointmentBySelectionId(
        args.appointment_selection_id,
        snap.appointmentManagement.verifiedExisting,
        snap.appointmentManagement.candidateSet,
      );
      if (!selected) {
        return voiceToolError(
          "INVALID_IDENTIFIER",
          "appointment_selection_id is not authorized for this call.",
          {},
          "invalid_selection",
        );
      }
      const verified = applyVerifiedExisting(snap, selected);
      ctx.runtime.replaceContext({
        ...verified,
        appointmentManagement: {
          ...verified.appointmentManagement,
          candidateSet: null,
          lookupCompleted: true,
        },
      });
      return toolOk("confirmed", {
        appointment_selection_id: appointmentSelectionId(selected),
        safe_display: selected.localStart,
        local_start: selected.localStart,
      });
    }

    const result = await findExistingAppointment(
      {
        callId: snap.callId,
        phone: merged.phone,
        email: merged.email,
        customerName: merged.name,
        service: merged.service,
        location: merged.location,
        dateHint: snap.scheduling.normalized,
        dateExpression: merged.dateExpression,
        timezone: snap.business.timezone,
        microsoftLookup: true,
        lookupState,
      },
      ctx.runtime.config,
    );

    const nextLookup = nextLookupStateFromResult(
      {
        callId: snap.callId,
        phone: merged.phone,
        email: merged.email,
        customerName: merged.name,
        service: merged.service,
        location: merged.location,
        dateExpression: merged.dateExpression,
        lookupState,
      },
      result,
    );

    const patchLookup = (base: VoiceV3CallContext): VoiceV3CallContext => ({
      ...base,
      appointmentManagement: {
        ...base.appointmentManagement,
        lookupState: nextLookup,
      },
      runtime: { version: base.runtime.version + 1 },
    });

    if (result.status === "VERIFICATION_FAILED") {
      return voiceToolError("VERIFICATION_FAILED", "Could not verify caller for appointment lookup.", {
        reason: result.reason,
      });
    }

    if (result.status === "NEEDS_MORE_INFORMATION") {
      ctx.runtime.replaceContext(patchLookup(snap));
      return toolOk("needs_more_information", {
        useful_discriminators: result.usefulDiscriminators,
      });
    }

    if (result.status === "NONE") {
      ctx.runtime.replaceContext(
        patchLookup({ ...snap, appointmentManagement: { ...snap.appointmentManagement, lookupCompleted: true } }),
      );
      return voiceToolError("APPOINTMENT_NOT_FOUND", "No matching appointment found.", {}, "not_found");
    }

    if (result.status === "MULTIPLE") {
      ctx.runtime.replaceContext(
        patchLookup({
          ...snap,
          appointmentManagement: {
            ...snap.appointmentManagement,
            candidateSet: result.candidateSet,
            lookupCompleted: true,
          },
        }),
      );
      return toolOk("ambiguous", {
        useful_discriminators: result.usefulDiscriminators,
        candidates: result.candidateSet.candidates.map((c) => ({
          selection_id: appointmentSelectionId(c.appointment),
          candidate_id: c.candidateId,
          display: c.appointment.localStart,
        })),
      });
    }

    if (result.status === "FOUND") {
      const candidateSet = buildSingleAppointmentCandidateSet(result.appointment);
      ctx.runtime.replaceContext(
        patchLookup({
          ...snap,
          appointmentManagement: {
            ...snap.appointmentManagement,
            candidateSet,
            lookupCompleted: true,
          },
        }),
      );
      return toolOk("needs_confirmation", {
        appointment_selection_id: appointmentSelectionId(result.appointment),
        safe_display: result.safeDisplay,
        local_start: result.appointment.localStart,
      });
    }

    return voiceToolError("APPOINTMENT_LOOKUP_FAILED", "Appointment lookup failed.", {}, "failed");
  },
};
