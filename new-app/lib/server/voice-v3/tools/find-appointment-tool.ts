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
import { buildAppointmentWhenFromSchedulingMeaning } from "../calendar/appointment-lookup-when";
import type { VoiceV3CallContext } from "../state/call-context";
import type { SchedulingMeaning } from "../time/scheduling-types";
import { schedulingMeaningZodObject } from "../time/scheduling-meaning-schema";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { FIND_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { resolveCustomerIdentityFromIntake } from "../intake-objective/resolve-stored-intake";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";

const findApptIdentitySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Caller or appointment holder name when explicitly provided. Null to use intake name already saved.",
    ),
  phone: z
    .string()
    .nullable()
    .describe(
      "Phone the caller stated is on the appointment — not inbound caller ID. Null to use intake phone already saved.",
    ),
  email: z
    .string()
    .nullable()
    .describe("Caller email when explicitly provided. Null to use intake email already saved."),
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

const findApptArgsSchema = findApptIdentitySchema.merge(
  schedulingMeaningZodObject.extend({
    date_expression: schedulingMeaningZodObject.shape.date_expression.describe(
      "When the caller describes the existing appointment date (Monday, tomorrow, YYYY-MM-DD). Null if unknown.",
    ),
    time_expression: schedulingMeaningZodObject.shape.time_expression.describe(
      "When the caller describes the existing appointment time (2:30 PM, around 10 in the morning). Use with date_relation/time_kind/exact_time/daypart — same semantics as set_scheduling_preference but for locating an existing appointment, not booking a new slot.",
    ),
  }),
);

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

function schedulingMeaningFromFindArgs(args: FindAppointmentArgs): SchedulingMeaning {
  return {
    date_expression: args.date_expression,
    date_relation: args.date_relation,
    weekday: args.weekday,
    explicit_date: args.explicit_date,
    time_expression: args.time_expression,
    time_kind: args.time_kind,
    exact_time: args.exact_time,
    start_time: args.start_time,
    end_time: args.end_time,
    daypart: args.daypart,
  };
}

function mergeFindArgs(
  ctx: VoiceV3CallContext,
  args: FindAppointmentArgs,
  config: VoiceV3AgentConfig,
) {
  const identity = resolveCustomerIdentityFromIntake(config, ctx.intake.values);
  return {
    name: args.name?.trim() || identity.name || undefined,
    phone: args.phone?.trim() || identity.phone || undefined,
    email: args.email?.trim() || identity.email || undefined,
    service: args.service?.trim() || undefined,
    location: args.location?.trim() || undefined,
  };
}

function trustedAni(ctx: VoiceV3CallContext): string | undefined {
  return ctx.telephony.inboundCallerE164?.trim() || ctx.appointmentManagement.lookupState?.ani;
}

export const findAppointmentTool: VoiceToolDefinition<FindAppointmentArgs> = {
  name: "find_appointment",
  description: "find_appointment",
  parameters: {},
  validate: (raw) => findApptArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    let snap = ctx.runtime.getSnapshot();
    const goalOp =
      snap.dialog.activeGoal === "CANCEL_APPOINTMENT"
        ? "cancel_appointment"
        : snap.dialog.activeGoal === "RESCHEDULE_APPOINTMENT"
          ? "reschedule_appointment"
          : "find_appointment";
    snap = mergeDialogActiveGoalFromOperation(snap, goalOp);
    ctx.runtime.replaceContext(snap);
    const config = ctx.runtime.config;

    if (snap.booking.phase === "BOOKING_CONFIRMED" && snap.booking.confirmed) {
      const confirmed = snap.booking.confirmed;
      return toolOk("booked_this_call", {
        local_start: confirmed.localStart,
        provider_event_id: confirmed.providerEventId,
        message: "Appointment was booked successfully on this call.",
      });
    }

    const merged = mergeFindArgs(snap, args, config);
    const lookupState = snap.appointmentManagement.lookupState;
    const appointmentWhen = buildAppointmentWhenFromSchedulingMeaning(
      schedulingMeaningFromFindArgs(args),
      snap.clock,
    );
    const ani = trustedAni(snap);

    const hasLookupConstraint =
      Boolean(merged.name || merged.phone || merged.email || merged.service || merged.location || ani) ||
      Boolean(args.explicit_date?.trim() || args.date_expression?.trim() || appointmentWhen?.normalized);

    if (
      !args.confirm_selection &&
      !args.appointment_selection_id &&
      !hasLookupConstraint &&
      snap.booking.phase !== "BOOKING_CONFIRMED"
    ) {
      return toolOk("not_booked_this_call", {
        booking_phase: snap.booking.phase,
        message:
          "No successful book_appointment on this call yet. Do not tell the caller they are booked — use set_scheduling_preference, find_availability, then book_appointment.",
      });
    }

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
        dateExpression: args.explicit_date?.trim() || args.date_expression?.trim() || null,
        timezone: snap.business.timezone,
        microsoftLookup: true,
        lookupState,
        appointmentWhen,
        ani,
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
        appointmentWhen,
        ani,
        lookupState,
      },
      result,
    );

    const patchLookup = (base: VoiceV3CallContext): VoiceV3CallContext => ({
      ...base,
      appointmentManagement: {
        ...base.appointmentManagement,
        lookupState: { ...nextLookup, ani: ani ?? nextLookup.ani },
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
