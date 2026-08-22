/**
 * MCTB consent modes — selectable runtime behavior (not UI-only).
 *
 * Storage keys remain `existing_consent` | `press_1` for backward compatibility.
 * Product labels: EXISTING_CONSENT | VERIFIED_CALL_CONSENT.
 */
export type MctbConsentMode = "existing_consent" | "press_1";

export const MCTB_CONSENT_MODE_EXISTING: MctbConsentMode = "existing_consent";
export const MCTB_CONSENT_MODE_VERIFIED: MctbConsentMode = "press_1";

export const MCTB_CONSENT_MODE_LABELS: Record<
  MctbConsentMode,
  { title: string; subtitle: string; productCode: string }
> = {
  press_1: {
    productCode: "VERIFIED_CALL_CONSENT",
    title: "Ask callers to press 1",
    subtitle:
      "We play a short disclosure and only text callers who press 1.",
  },
  existing_consent: {
    productCode: "EXISTING_CONSENT",
    title: "I already have permission to text these callers",
    subtitle:
      "No Press 1. You certify that you already have the required consent.",
  },
};

export function normalizeMctbConsentMode(raw: unknown): MctbConsentMode {
  const mode = String(raw || MCTB_CONSENT_MODE_VERIFIED);
  return mode === MCTB_CONSENT_MODE_EXISTING
    ? MCTB_CONSENT_MODE_EXISTING
    : MCTB_CONSENT_MODE_VERIFIED;
}

export function isExistingConsentMode(mode: MctbConsentMode): boolean {
  return mode === MCTB_CONSENT_MODE_EXISTING;
}

export function isVerifiedCallConsentMode(mode: MctbConsentMode): boolean {
  return mode === MCTB_CONSENT_MODE_VERIFIED;
}

export const EXISTING_CONSENT_METHOD = "EXISTING_CONSENT";
export const EXISTING_CONSENT_SCOPE = "EXISTING_CONSENT";
export const EXISTING_CONSENT_ATTESTATION = "ATTESTED";
