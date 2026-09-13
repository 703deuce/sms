import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";

/** True when an enabled policy may use calendar booking adapters (link or AI book). */
export function workspaceUsesBookingProvider(config: LeadRecoveryWorkspaceConfig): boolean {
  if (!config.enabledScenarios.booking && !config.enabledScenarios.service_area) return false;
  const booking = config.intentPolicies.BOOKING_REQUEST;
  const spec = config.intentPolicies.SPECIFIC_TIME_REQUEST;
  const emergency = config.intentPolicies.EMERGENCY_OR_URGENT;
  const usesActions = (pol?: { actions?: string[] }) =>
    Boolean(pol?.actions?.some((a) => a === "AI_BOOK" || a === "SEND_BOOKING_LINK"));
  if (usesActions(booking) || usesActions(spec) || usesActions(emergency)) return true;
  if (config.serviceAreaPolicy.inAreaAction === "ai_book" || config.serviceAreaPolicy.inAreaAction === "booking_link") {
    return config.enabledScenarios.service_area === true;
  }
  return false;
}

export function workspaceUsesAiBookTarget(config: LeadRecoveryWorkspaceConfig): boolean {
  if (!workspaceUsesBookingProvider(config)) return false;
  const check = (pol?: { actions?: string[] }) => Boolean(pol?.actions?.includes("AI_BOOK"));
  return (
    check(config.intentPolicies.BOOKING_REQUEST) ||
    check(config.intentPolicies.SPECIFIC_TIME_REQUEST) ||
    check(config.intentPolicies.EMERGENCY_OR_URGENT) ||
    config.serviceAreaPolicy.inAreaAction === "ai_book"
  );
}

export function workspaceUsesTextToPay(config: LeadRecoveryWorkspaceConfig): boolean {
  if (!config.enabledScenarios.payments) return false;
  if (config.paymentPolicy.textToPayEnabled) return true;
  return Boolean(config.intentPolicies.PAYMENT_REQUEST?.actions?.includes("SEND_TEXT_TO_PAY"));
}
