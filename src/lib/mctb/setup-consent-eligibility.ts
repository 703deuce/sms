/**
 * UI + API eligibility for Existing Consent mode.
 * Canonical gate: approved messaging sender + no blocking compliance actions
 * (same signal as Setup Overview `existingConsentBlocked`).
 */
export function isExistingConsentModeEligible(input: {
  messagingReady: boolean;
}): boolean {
  return input.messagingReady;
}

export function existingConsentIneligibleReason(messagingReady: boolean): string | null {
  if (messagingReady) return null;
  return "Existing-consent mode requires an eligible business messaging setup.";
}
