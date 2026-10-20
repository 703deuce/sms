import type { VoiceV3AgentConfig } from "../config/agent-config";

/**
 * Wizard `confirmBeforeBooking` — deterministic gate for book_appointment tool args only.
 * No persistent call-context field; GPT-Live remains responsible for obtaining agreement in conversation.
 */
export function isBookingVerbalConfirmationRequired(config: VoiceV3AgentConfig): boolean {
  return config.scheduling?.bookingBehavior?.confirmBeforeBooking === true;
}

export function isCallerVerbalConfirmationSatisfied(
  config: VoiceV3AgentConfig,
  callerVerbalConfirmed: boolean | null | undefined,
): boolean {
  if (!isBookingVerbalConfirmationRequired(config)) return true;
  return callerVerbalConfirmed === true;
}
