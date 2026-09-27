import { CERT_BUSINESS_LINE } from "@/lib/cert/appointments-mctb-browser-cert-constants";

function normalizeCandidate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Public business line shown in Setup / Test — not the hidden Transovo forward target.
 * Deprioritizes browser-cert placeholder when onboarding has a real number.
 */
export function resolveMctbWorkspaceBusinessLineE164(
  settingsLine: string | null | undefined,
  onboardingLine: string | null | undefined,
): string | null {
  const settings = normalizeCandidate(settingsLine);
  const onboarding = normalizeCandidate(onboardingLine);

  if (settings && settings !== CERT_BUSINESS_LINE) return settings;
  if (onboarding && onboarding !== CERT_BUSINESS_LINE) return onboarding;
  return settings || onboarding || null;
}
