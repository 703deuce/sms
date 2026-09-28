/**
 * UI + API eligibility for Existing Consent mode.
 * Canonical gate: approved messaging sender + no blocking compliance actions
 * (same signal as Setup Overview `existingConsentBlocked`).
 */
export function isExistingConsentModeEligible(input: {
  messagingReady: boolean;
  /** Free / trial workspaces cannot enable existing permission (Pass 1B). */
  paidEntitled?: boolean;
}): boolean {
  if (input.paidEntitled === false) return false;
  return input.messagingReady;
}

export function existingConsentIneligibleReason(
  messagingReady: boolean,
  paidEntitled = true,
): string | null {
  if (!paidEntitled) {
    return "Available with Recovery. Press 1 is included on your current plan.";
  }
  if (messagingReady) return null;
  return "Use existing permission requires messaging to be ready on your connected number.";
}
