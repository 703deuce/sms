import "server-only";

import { getPrisma } from "@/lib/db";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";

export const EXISTING_CONSENT_ATTESTATION_VERSION = "1";

export type ExistingConsentAttestationRecord = {
  accepted: boolean;
  version: string;
  attestedByUserId: string;
  attestedAt: string;
};

export type ExistingConsentAttestationValidation = {
  valid: boolean;
  consentMode: string;
  existingConsentValid: boolean;
  reason?: string;
  attestation?: ExistingConsentAttestationRecord | null;
};

function readAttestationFromWorkspace(
  customFieldsConfig: unknown,
): ExistingConsentAttestationRecord | null {
  const cfg =
    customFieldsConfig && typeof customFieldsConfig === "object"
      ? (customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb = cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const raw = mctb.existingConsentAttestation;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.accepted !== true) return null;
  const attestedByUserId = String(row.attestedByUserId || "");
  const attestedAt = String(row.attestedAt || "");
  if (!attestedByUserId || !attestedAt) return null;
  return {
    accepted: true,
    version: String(row.version || EXISTING_CONSENT_ATTESTATION_VERSION),
    attestedByUserId,
    attestedAt,
  };
}

/** Persist workspace-level Existing Consent attestation (setup/onboarding). */
export async function recordWorkspaceExistingConsentAttestation(input: {
  workspaceId: string;
  attestedByUserId: string;
  version?: string;
}) {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const customCfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const attestation: ExistingConsentAttestationRecord = {
    accepted: true,
    version: input.version || EXISTING_CONSENT_ATTESTATION_VERSION,
    attestedByUserId: input.attestedByUserId,
    attestedAt: new Date().toISOString(),
  };

  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      customFieldsConfig: {
        ...customCfg,
        mctb: {
          ...mctb,
          consentMode: MCTB_CONSENT_MODE_EXISTING,
          existingConsentAttestation: attestation,
        },
      },
    },
  });

  return attestation;
}

/** Server-side Existing Consent attestation gate — do not trust UI alone. */
export async function validateExistingConsentAttestation(
  workspaceId: string,
): Promise<ExistingConsentAttestationValidation> {
  const consentMode = await loadMctbConsentMode(workspaceId);
  if (consentMode !== MCTB_CONSENT_MODE_EXISTING) {
    return {
      valid: false,
      consentMode,
      existingConsentValid: false,
      reason: "NOT_EXISTING_CONSENT",
    };
  }

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true, status: true },
  });
  if (!ws || String(ws.status || "").toLowerCase() === "inactive") {
    return {
      valid: false,
      consentMode,
      existingConsentValid: false,
      reason: "WORKSPACE_INACTIVE",
    };
  }

  const attestation = readAttestationFromWorkspace(ws.customFieldsConfig);
  if (attestation) {
    const user = await prisma.user.findUnique({
      where: { id: attestation.attestedByUserId },
      select: { id: true },
    });
    if (!user) {
      return {
        valid: false,
        consentMode,
        existingConsentValid: false,
        reason: "MISSING_ATTESTATION",
        attestation,
      };
    }
    return {
      valid: true,
      consentMode,
      existingConsentValid: true,
      attestation,
    };
  }

  const onboarding = parseMctbOnboardingState(ws.customFieldsConfig);
  const completedConsentStep = onboarding.completedSteps.includes("consent");
  if (completedConsentStep && onboarding.consentMode === MCTB_CONSENT_MODE_EXISTING) {
    return {
      valid: true,
      consentMode,
      existingConsentValid: true,
      attestation: null,
    };
  }

  return {
    valid: false,
    consentMode,
    existingConsentValid: false,
    reason: "MISSING_ATTESTATION",
    attestation: null,
  };
}
