import "server-only";

import type { VoiceV2CallContext } from "./intake/types";

/** Authoritative primary action outcome for a call — provider wins over intake gaps. */
export type VoiceV2PrimaryOutcome =
  | "BOOKED"
  | "BOOKING_LINK_SENT"
  | "CALLBACK_REQUESTED"
  | "TRANSFERRED"
  | "RESCHEDULED"
  | "CANCELED"
  | "MESSAGE_TAKEN"
  | "APPOINTMENT_REQUESTED"
  | "NONE";

function transferSucceeded(ctx: VoiceV2CallContext): boolean {
  return ctx.afterHours?.transfer?.status === "SUCCEEDED";
}

export function resolveVoiceV2PrimaryOutcome(ctx: VoiceV2CallContext): VoiceV2PrimaryOutcome {
  const w = ctx.bookingWorkflow;
  if (w?.bookingConfirmed) return "BOOKED";

  const actionStatus = ctx.appointmentAction?.status;
  if (actionStatus === "RESCHEDULE_CONFIRMED") return "RESCHEDULED";
  if (actionStatus === "CANCEL_CONFIRMED") return "CANCELED";

  if (transferSucceeded(ctx)) return "TRANSFERRED";

  if (w?.bookingLinkSent) return "BOOKING_LINK_SENT";
  if (ctx.afterHours?.callback?.requested || w?.callbackRequested) return "CALLBACK_REQUESTED";
  if (w?.callerRequestFinalized) {
    const strategy = ctx.capabilities?.bookingStrategy;
    if (strategy === "REQUEST_ONLY") return "APPOINTMENT_REQUESTED";
    return "MESSAGE_TAKEN";
  }
  return "NONE";
}

export function primaryOutcomeSucceeded(outcome: VoiceV2PrimaryOutcome): boolean {
  return outcome !== "NONE";
}
