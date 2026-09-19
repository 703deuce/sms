import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchRescheduleIfRequired } from "../calendar/reschedule-dispatch";
import {
  appointmentSelectionId,
  resolveVerifiedAppointmentBySelectionId,
} from "../calendar/find-existing-appointment";
import type { VoiceV3CallContext } from "../state/call-context";
import { authorizeVoiceV3ToolOrError } from "./authorize-tool-for-config";
import type { AvailabilityOfferSet } from "../calendar/offer-set";
import type { AvailabilitySlot } from "../calendar/slot-generator";
import type { SelectedAvailabilitySlot } from "../calendar/selected-slot";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { RESCHEDULE_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const rescheduleArgsSchema = z.object({
  appointment_selection_id: z
    .string()
    .nullable()
    .describe(
      "appointment_selection_id from find_appointment. Null to use verified appointment in call state. Never invent provider event ids.",
    ),
  offer_set_id: z
    .string()
    .min(1)
    .describe("Identifier of the current verified availability offer containing the replacement slot."),
  slot_id: z
    .string()
    .min(1)
    .describe("Identifier of the replacement slot selected or clearly accepted by the caller."),
});

export type RescheduleAppointmentArgs = z.infer<typeof rescheduleArgsSchema>;

function bindSlot(
  ctx: VoiceV3CallContext,
  offer: AvailabilityOfferSet,
  slot: AvailabilitySlot,
): VoiceV3CallContext {
  const nextSelected: SelectedAvailabilitySlot = {
    offerSetId: offer.offerSetId,
    slotId: slot.slotId,
    schedulingGeneration: ctx.scheduling.generation,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    localStart: slot.localStart,
    localEnd: slot.localEnd,
    timezone: ctx.business.timezone,
  };
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    dialog: { ...ctx.dialog, activeGoal: "RESCHEDULE_APPOINTMENT" },
    selection: { selected: nextSelected, lastResolutionStatus: "RESOLVED" },
    availability: { ...ctx.availability, activeOfferSet: offer, status: "ready" },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export function buildRescheduleAppointmentOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "reschedule_appointment",
    parameters: rescheduleArgsSchema,
    description: RESCHEDULE_APPOINTMENT_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const rescheduleAppointmentTool: VoiceToolDefinition<RescheduleAppointmentArgs> = {
  name: "reschedule_appointment",
  description: "reschedule_appointment",
  parameters: {},
  validate: (raw) => rescheduleArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const denied = authorizeVoiceV3ToolOrError(ctx.runtime.config, "reschedule_appointment");
    if (denied) return denied;
    const snap = ctx.runtime.getSnapshot();
    let existing = snap.appointmentManagement.verifiedExisting;
    const selected = resolveVerifiedAppointmentBySelectionId(
      args.appointment_selection_id,
      existing,
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
    if (selected) {
      existing = selected;
      if (selected !== snap.appointmentManagement.verifiedExisting) {
        ctx.runtime.replaceContext({
          ...snap,
          appointmentManagement: {
            ...snap.appointmentManagement,
            verifiedExisting: selected,
            candidateSet: null,
          },
        });
      }
    }
    if (!existing) {
      return voiceToolError(
        "APPOINTMENT_NOT_FOUND",
        "No verified appointment. Call find_appointment first.",
        {},
        "not_ready",
      );
    }
    if (
      args.appointment_selection_id?.trim() &&
      appointmentSelectionId(existing) !== args.appointment_selection_id.trim()
    ) {
      return voiceToolError(
        "INVALID_IDENTIFIER",
        "appointment_selection_id does not match verified appointment.",
        {},
        "invalid_selection",
      );
    }

    const offer = snap.availability.activeOfferSet;
    if (!offer || offer.offerSetId !== args.offer_set_id) {
      return voiceToolError("STALE_OFFER_SET", "Offer set is not current.", {}, "invalid_selection");
    }
    const slot = offer.slots.find((s) => s.slotId === args.slot_id);
    if (!slot) {
      return voiceToolError("INVALID_SLOT", "Slot not in offer set.", {}, "invalid_selection");
    }

    ctx.runtime.replaceContext(bindSlot(snap, offer, slot));

    const silentHooks = {
      onLiveContext: (event: { type: string; [key: string]: unknown }) => {
        ctx.sendContext(event);
      },
    };

    await dispatchRescheduleIfRequired(ctx.runtime, silentHooks);
    const after = ctx.runtime.getSnapshot();
    if (after.appointmentManagement.reschedule.phase === "RESCHEDULE_CONFIRMED") {
      return toolOk("rescheduled", {
        provider_event_id: existing.providerEventId,
        display_time: after.appointmentManagement.verifiedExisting?.localStart,
      });
    }
    if (
      after.appointmentManagement.reschedule.phase === "RESCHEDULE_FAILED" ||
      after.appointmentManagement.reschedule.phase === "RESCHEDULE_OUTCOME_UNKNOWN"
    ) {
      return voiceToolError(
        after.appointmentManagement.reschedule.phase,
        "Reschedule did not complete.",
        { phase: after.appointmentManagement.reschedule.phase },
        "failed",
      );
    }
    return toolOk("pending", { phase: after.appointmentManagement.reschedule.phase });
  },
};
