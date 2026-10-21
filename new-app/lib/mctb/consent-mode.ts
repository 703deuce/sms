export type MctbConsentMode = "existing_consent" | "press_1";

export const MCTB_CONSENT_MODE_EXISTING: MctbConsentMode = "existing_consent";
export const MCTB_CONSENT_MODE_VERIFIED: MctbConsentMode = "press_1";

export const MCTB_CONSENT_MODE_LABELS: Record<
  MctbConsentMode,
  { title: string; subtitle: string }
> = {
  press_1: {
    title: "Ask callers to press 1",
    subtitle: "Short voice disclosure; text only after the caller presses 1.",
  },
  existing_consent: {
    title: "I already have permission to text these callers",
    subtitle: "You certify that you already have required consent. No Press 1.",
  },
};

export function normalizeMctbConsentMode(raw: unknown): MctbConsentMode {
  const mode = String(raw || MCTB_CONSENT_MODE_EXISTING);
  return mode === MCTB_CONSENT_MODE_EXISTING ? MCTB_CONSENT_MODE_EXISTING : MCTB_CONSENT_MODE_VERIFIED;
}

export function isExistingConsentMode(mode: MctbConsentMode): boolean {
  return mode === MCTB_CONSENT_MODE_EXISTING;
}
