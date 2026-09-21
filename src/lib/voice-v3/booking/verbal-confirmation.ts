import type { VoiceV3AgentConfig } from "../config/agent-config";

export type BookingVerbalConfirmationStatus = "NOT_REQUIRED" | "AWAITING" | "CONFIRMED";

export function isBookingVerbalConfirmationRequired(config: VoiceV3AgentConfig): boolean {
  return config.scheduling?.bookingBehavior?.confirmBeforeBooking === true;
}

export function initialVerbalConfirmationStatus(
  config: VoiceV3AgentConfig,
): BookingVerbalConfirmationStatus {
  return isBookingVerbalConfirmationRequired(config) ? "AWAITING" : "NOT_REQUIRED";
}

export function isBookingVerbalConfirmationSatisfied(
  config: VoiceV3AgentConfig,
  status: BookingVerbalConfirmationStatus,
): boolean {
  if (!isBookingVerbalConfirmationRequired(config)) return true;
  return status === "CONFIRMED";
}
