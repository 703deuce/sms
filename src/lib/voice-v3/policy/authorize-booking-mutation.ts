import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { SelectedAvailabilitySlot } from "../calendar/selected-slot";
import { isVoiceV3ToolAuthorizedEffective } from "./effective-tool-authorization";
import {
  isBookingVerbalConfirmationRequired,
  isBookingVerbalConfirmationSatisfied,
} from "../booking/verbal-confirmation";
import { getMissingFieldsForOperation } from "../intake-objective/operation-requirements";

export type BookingMutationAuthorization =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function authorizeVoiceV3BookingMutation(input: {
  config: VoiceV3AgentConfig;
  ctx: VoiceV3CallContext;
  selected: SelectedAvailabilitySlot;
}): BookingMutationAuthorization {
  if (
    !isVoiceV3ToolAuthorizedEffective(input.config, "book_appointment", undefined, input.ctx)
  ) {
    return {
      allowed: false,
      code: "OPERATING_POLICY_BLOCKED",
      message: "Booking is not allowed in the current operating state or configuration.",
    };
  }

  const offer = input.ctx.availability.activeOfferSet;
  if (!offer || offer.offerSetId !== input.selected.offerSetId) {
    return {
      allowed: false,
      code: "STALE_OFFER_SET",
      message: "Offer set is no longer current.",
    };
  }
  if (input.selected.schedulingGeneration !== input.ctx.scheduling.generation) {
    return {
      allowed: false,
      code: "STALE_SCHEDULING_GENERATION",
      message: "Scheduling context changed; find availability again.",
    };
  }
  const slot = offer.slots.find((s) => s.slotId === input.selected.slotId);
  if (!slot) {
    return {
      allowed: false,
      code: "INVALID_SLOT",
      message: "Selected slot is not in the active offer set.",
    };
  }

  const missing = getMissingFieldsForOperation(input.config, input.ctx, "book_appointment");
  if (missing.length) {
    return {
      allowed: false,
      code: "INTAKE_INCOMPLETE",
      message: `Missing required intake: ${missing.join(", ")}`,
    };
  }

  if (
    isBookingVerbalConfirmationRequired(input.config) &&
    !isBookingVerbalConfirmationSatisfied(input.ctx)
  ) {
    return {
      allowed: false,
      code: "BOOKING_CONFIRMATION_REQUIRED",
      message: "Caller must explicitly confirm the appointment before booking.",
    };
  }

  return { allowed: true };
}
