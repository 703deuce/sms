/**
 * UI + API eligibility for Existing Consent mode.
 * Free plan: Press-1 and existing permission (with attestation) are both available.
 * Platform sender: no workspace A2P/TFV — Transovo numbers are pre-verified.
 * Own number (WORKSPACE sender): requires approved messaging on the connected number.
 */
export function isExistingConsentModeEligible(input: {
  messagingReady: boolean;
  platformSenderActive?: boolean;
  /** MCTB product entitled (including free plan). */
  mctbProductActive?: boolean;
}): boolean {
  if (input.platformSenderActive) return true;
  if (input.messagingReady) return true;
  if (input.mctbProductActive) return true;
  return false;
}

export function existingConsentIneligibleReason(
  messagingReady: boolean,
  platformSenderActive = false,
  mctbProductActive = false,
): string | null {
  if (isExistingConsentModeEligible({ messagingReady, platformSenderActive, mctbProductActive })) {
    return null;
  }
  return "Missed Call Text Back is not active on this workspace.";
}
