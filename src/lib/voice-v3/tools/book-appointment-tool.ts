import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchBookingIfRequired } from "../calendar/book-dispatch";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import type { VoiceV3CallContext } from "../state/call-context";
import { BOOK_APPOINTMENT_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import type { AvailabilityOfferSet } from "../calendar/offer-set";
import type { AvailabilitySlot } from "../calendar/slot-generator";
import type { SelectedAvailabilitySlot } from "../calendar/selected-slot";

const bookArgsSchema = z.object({
  offer_set_id: z
    .string()
    .min(1)
    .describe("offer_set_id from the latest find_availability result for this call."),
  slot_id: z
    .string()
    .min(1)
    .describe("slot_id from that offer set matching the slot the caller chose."),
});

export type BookAppointmentArgs = z.infer<typeof bookArgsSchema>;

function bindAuthoritativeSlotSelection(
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
    selection: {
      selected: nextSelected,
      lastResolutionStatus: "RESOLVED",
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export function buildBookAppointmentOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "book_appointment",
    parameters: bookArgsSchema,
    description: BOOK_APPOINTMENT_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const bookAppointmentTool: VoiceToolDefinition<BookAppointmentArgs> = {
  name: "book_appointment",
  description: "book_appointment",
  parameters: {},
  validate: (raw) => bookArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const snap = ctx.runtime.getSnapshot();
    const offer = snap.availability.activeOfferSet;
    if (!offer || offer.offerSetId !== args.offer_set_id) {
      return voiceToolError(
        "STALE_OFFER_SET",
        "Offer set is not current. Run find_availability again.",
        { requested: args.offer_set_id },
        "invalid_selection",
      );
    }
    const slot = offer.slots.find((s) => s.slotId === args.slot_id);
    if (!slot) {
      return voiceToolError(
        "INVALID_SLOT",
        "Slot id is not in the active offer set.",
        { slot_id: args.slot_id },
        "invalid_selection",
      );
    }

    const withOffer = {
      ...snap,
      availability: { ...snap.availability, activeOfferSet: offer, status: "ready" as const },
    };
    const withSelection = bindAuthoritativeSlotSelection(withOffer, offer, slot);
    ctx.runtime.replaceContext(withSelection);

    const rules = evaluateVoiceV3Rules(ctx.runtime.getSnapshot(), config);
    if (rules.missingRequiredFields.length > 0) {
      return voiceToolError(
        "MISSING_REQUIRED_INFORMATION",
        "Required intake is incomplete.",
        { missing: rules.missingRequiredFields },
        "not_ready",
      );
    }
    if (!rules.bookingReady) {
      return voiceToolError(
        "NOT_READY",
        "Booking is not ready yet.",
        { required_action: rules.requiredAction },
        "not_ready",
      );
    }

    const silentHooks = {
      onLiveContext: (event: { type: string; [key: string]: unknown }) => {
        ctx.sendContext(event);
      },
    };

    await dispatchBookingIfRequired(ctx.runtime, silentHooks);

    const after = ctx.runtime.getSnapshot();
    if (after.booking.phase === "BOOKING_CONFIRMED" && after.booking.confirmed) {
      return toolOk("confirmed", {
        provider_event_id: after.booking.confirmed.providerEventId,
        display_time: after.booking.confirmed.displayTime,
      });
    }
    if (after.booking.lastFailure) {
      return voiceToolError(
        after.booking.lastFailure.code,
        "Booking did not complete.",
        { failure: after.booking.lastFailure },
        "failed",
      );
    }
    return toolOk("outcome_unknown", {
      code: "BOOKING_OUTCOME_UNKNOWN",
      booking_attempt_id: after.booking.activeAttempt?.bookingAttemptId ?? null,
    });
  },
};
