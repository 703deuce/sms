import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchCancellationIfRequired } from "../calendar/cancel-dispatch";
import {
  appointmentSelectionId,
  resolveVerifiedAppointmentBySelectionId,
} from "../calendar/find-existing-appointment";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { CANCEL_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { authorizeVoiceV3ToolOrError } from "./authorize-tool-for-config";

const cancelArgsSchema = z.object({
  appointment_selection_id: z
    .string()
    .nullable()
    .describe(
      "appointment_selection_id from find_appointment. Null to use verified appointment in call state. Never invent provider event ids.",
    ),
  confirmed: z
    .boolean()
    .describe(
      "True only after the caller explicitly confirmed cancellation. False must not be sent — wait for confirmation instead.",
    ),
});

export type CancelAppointmentArgs = z.infer<typeof cancelArgsSchema>;

export function buildCancelAppointmentOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "cancel_appointment",
    parameters: cancelArgsSchema,
    description: CANCEL_APPOINTMENT_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

function prepareCancelContext(
  ctx: VoiceV3CallContext,
  args: CancelAppointmentArgs,
): VoiceV3CallContext | null {
  const existing = ctx.appointmentManagement.verifiedExisting;
  if (!existing) return null;
  if (
    args.appointment_selection_id &&
    appointmentSelectionId(existing) !== args.appointment_selection_id.trim() &&
    existing.providerEventId === args.appointment_selection_id.trim()
  ) {
    return null;
  }
  if (
    args.appointment_selection_id &&
    appointmentSelectionId(existing) !== args.appointment_selection_id.trim()
  ) {
    return null;
  }
  const verified = ctx.appointmentManagement.verifiedExisting;
  const boundEventId = verified?.providerEventId ?? null;

  if (!args.confirmed) {
    return {
      ...ctx,
      dialog: { ...ctx.dialog, activeGoal: "CANCEL_APPOINTMENT" },
      appointmentManagement: {
        ...ctx.appointmentManagement,
        cancellation: {
          ...ctx.appointmentManagement.cancellation,
          awaitingConfirmation: true,
          boundProviderEventId: boundEventId,
        },
      },
    };
  }

  // Tool-confirmed cancellation (PSTN path): set lastCancellationConfirmation CONFIRM so
  // evaluateVoiceV3Rules cancelReady arms dispatchCancellationIfRequired.
  if (!boundEventId) return null;

  console.log("CANCELLATION_CONFIRMED_BY_TOOL", {
    call_id: ctx.callId,
    provider_event_id: boundEventId,
  });

  return {
    ...ctx,
    dialog: { ...ctx.dialog, activeGoal: "CANCEL_APPOINTMENT" },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      lastCancellationConfirmation: "CONFIRM",
      cancellation: {
        ...ctx.appointmentManagement.cancellation,
        phase: "CANCELLATION_READY",
        awaitingConfirmation: true,
        boundProviderEventId: boundEventId,
      },
    },
  };
}

export const cancelAppointmentTool: VoiceToolDefinition<CancelAppointmentArgs> = {
  name: "cancel_appointment",
  description: "cancel_appointment",
  parameters: {},
  validate: (raw) => cancelArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const denied = authorizeVoiceV3ToolOrError(ctx.runtime.config, "cancel_appointment");
    if (denied) return denied;
    if (!args.confirmed) {
      return voiceToolError(
        "CANCELLATION_CONFIRMATION_REQUIRED",
        "Caller must confirm cancellation before cancel_appointment.",
        {},
        "not_ready",
      );
    }

    const snap = ctx.runtime.getSnapshot();
    const selected = resolveVerifiedAppointmentBySelectionId(
      args.appointment_selection_id,
      snap.appointmentManagement.verifiedExisting,
      snap.appointmentManagement.candidateSet,
    );
    if (args.appointment_selection_id?.trim() && !selected) {
      return voiceToolError(
        "INVALID_IDENTIFIER",
        "appointment_selection_id is not authorized for this call.",
        {},
        "invalid_selection",
      );
    }
    let working = snap;
    if (selected && selected !== snap.appointmentManagement.verifiedExisting) {
      working = {
        ...snap,
        appointmentManagement: {
          ...snap.appointmentManagement,
          verifiedExisting: selected,
          candidateSet: null,
        },
      };
      ctx.runtime.replaceContext(working);
    }
    const next = prepareCancelContext(working, args);
    if (!next?.appointmentManagement.verifiedExisting) {
      return voiceToolError(
        "APPOINTMENT_NOT_FOUND",
        "No verified appointment to cancel. Call find_appointment first.",
        {},
        "not_ready",
      );
    }

    ctx.runtime.replaceContext(next);

    const silentHooks = {
      onLiveContext: (event: { type: string; [key: string]: unknown }) => {
        ctx.sendContext(event);
      },
    };

    await dispatchCancellationIfRequired(ctx.runtime, silentHooks);
    const after = ctx.runtime.getSnapshot();
    if (after.appointmentManagement.cancellation.phase === "CANCELLATION_CONFIRMED") {
      return toolOk("cancelled", {
        provider_event_id: after.appointmentManagement.verifiedExisting?.providerEventId,
      });
    }
    if (
      after.appointmentManagement.cancellation.phase === "CANCELLATION_FAILED" ||
      after.appointmentManagement.cancellation.phase === "CANCELLATION_OUTCOME_UNKNOWN"
    ) {
      return voiceToolError(
        after.appointmentManagement.cancellation.phase,
        "Cancellation did not complete.",
        { phase: after.appointmentManagement.cancellation.phase },
        "failed",
      );
    }
    return toolOk("pending", { phase: after.appointmentManagement.cancellation.phase });
  },
};
