import {
  MCTB_CONSENT_MODE_EXISTING,
  normalizeMctbConsentMode,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";

export type MctbConsentModeSource =
  | "canonical_mctb"
  | "solution_setup"
  | "onboarding_explicit"
  | "existing_attestation"
  | "default";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readExistingConsentAttestation(
  customFieldsConfig: unknown,
): { attestedByUserId: string; attestedAt: string } | null {
  const mctb = asRecord(asRecord(customFieldsConfig).mctb);
  const raw = mctb.existingConsentAttestation;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.accepted !== true) return null;
  const attestedByUserId = String(row.attestedByUserId || "");
  const attestedAt = String(row.attestedAt || "");
  if (!attestedByUserId || !attestedAt) return null;
  return { attestedByUserId, attestedAt };
}

function onboardingHasExplicitConsentMode(customFieldsConfig: unknown): boolean {
  const raw = asRecord(asRecord(customFieldsConfig).mctbOnboarding);
  return typeof raw.consentMode === "string" && raw.consentMode.length > 0;
}

/** Resolve consent mode from workspace JSON + optional solution setup — no Prisma. */
export function resolveMctbConsentModeFromCustomFields(input: {
  customFieldsConfig: unknown;
  solutionConsentMode?: unknown;
}): { mode: MctbConsentMode; source: MctbConsentModeSource } {
  const cfg = asRecord(input.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);

  if (typeof mctb.consentMode === "string" && mctb.consentMode.length > 0) {
    return {
      mode: normalizeMctbConsentMode(mctb.consentMode),
      source: "canonical_mctb",
    };
  }

  if (
    typeof input.solutionConsentMode === "string" &&
    input.solutionConsentMode.length > 0
  ) {
    return {
      mode: normalizeMctbConsentMode(input.solutionConsentMode),
      source: "solution_setup",
    };
  }

  if (readExistingConsentAttestation(cfg)) {
    return {
      mode: MCTB_CONSENT_MODE_EXISTING,
      source: "existing_attestation",
    };
  }

  if (onboardingHasExplicitConsentMode(cfg)) {
    const onboarding = asRecord(cfg.mctbOnboarding);
    return {
      mode: normalizeMctbConsentMode(onboarding.consentMode),
      source: "onboarding_explicit",
    };
  }

  return {
    mode: normalizeMctbConsentMode(undefined),
    source: "default",
  };
}
