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
  existing_consent: {
    productCode: "EXISTING_CONSENT",
    title: "Already Have Consent",
    subtitle:
      "You confirm callers already have valid consent through your existing relationship, forms, agreements, etc.",
  },
  press_1: {
    productCode: "VERIFIED_CALL_CONSENT",
    title: "Verified Call Consent",
    subtitle:
      "Transovo plays your published consent message and only sends the text after the caller presses 1.",
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
