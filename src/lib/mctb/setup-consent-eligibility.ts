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
    return "Use existing permission is available on paid plans with an approved messaging sender.";
  }
  if (messagingReady) return null;
  return "Use existing permission requires messaging to be ready on your connected number.";
}
