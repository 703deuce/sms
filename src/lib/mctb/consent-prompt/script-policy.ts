import { defaultMctbConsentScript } from "@/lib/mctb/consent-prompt/defaults";

/**
 * Press-1 **voice** disclosure (pre-DTMF) — Transovo-approved wording.
 * Customers may change business name (via workspace profile) and voice presentation (TTS voice/speed).
 * They may NOT rewrite compliance-bearing phrasing (press-1 offer, opt-in mechanics).
 */
export function resolveCanonicalMctbConsentScript(businessName?: string | null): string {
  return defaultMctbConsentScript(businessName || undefined);
}

export function consentScriptMatchesCanonical(scriptText: string, businessName?: string | null): boolean {
  const canonical = resolveCanonicalMctbConsentScript(businessName);
  return scriptText.trim() === canonical.trim();
}

export function assertCustomerEditableConsentScript(scriptText: string, businessName?: string | null): void {
  if (consentScriptMatchesCanonical(scriptText, businessName)) return;
  throw new Error(
    "Press-1 voice disclosure uses fixed Transovo-approved wording. Update your business display name in Settings if the greeting should name your business differently. You can change voice and speed, then regenerate and publish audio.",
  );
}

export const MCTB_CONSENT_SCRIPT_CUSTOMER_EDIT_HINT =
  "Wording is Transovo-approved for Press-1 consent. Change your business name in Settings; customize voice and speed below.";
