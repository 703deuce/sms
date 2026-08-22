import "server-only";

import { getPrisma } from "@/lib/db";
import {
  loadMissedCallTextConfig,
} from "@/lib/agents/missed-call-text-back/config";
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";
import {
  EXISTING_CONSENT_ATTESTATION_VERSION,
  type ExistingConsentAttestationRecord,
  validateExistingConsentAttestation,
} from "@/lib/mctb/event-only/attestation";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";

export type MctbSetupStatus =
  | "draft"
  | "setup_required"
  | "testing"
  | "active"
  | "paused"
  | "error";

export type MctbWorkspaceConfig = {
  workspaceId: string;
  enabled: boolean;
  status: MctbSetupStatus;
  phoneNumberId: string | null;
  providerPhoneNumber: string | null;
  consentMode: MctbConsentMode;
  greetingAssetId: string | null;
  greetingAudioUrl: string | null;
  greetingVersion: number | null;
  confirmationAssetId: string | null;
  recoveryMessage: string;
  smsDelaySeconds: number;
  demoMode: boolean;
  cooldownSeconds: number;
  existingConsentAttested: boolean;
  existingConsentAttestedAt: string | null;
  existingConsentAttestedBy: string | null;
  existingConsentVersion: string | null;
  runtime: MissedCallTextConfigRecord;
};

function readAttestation(
  customFieldsConfig: unknown,
): ExistingConsentAttestationRecord | null {
  const cfg =
    customFieldsConfig && typeof customFieldsConfig === "object"
      ? (customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
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

function deriveStatus(input: {
  enabled: boolean;
  runtime: MissedCallTextConfigRecord;
  attestationValid: boolean;
  consentMode: MctbConsentMode;
}): MctbSetupStatus {
  if (!input.enabled) return "paused";
  if (!input.runtime.phoneNumberId) return "setup_required";
  if (
    input.consentMode === "existing_consent" &&
    !input.attestationValid
  ) {
    return "setup_required";
  }
  return "active";
}

/** Canonical MCTB workspace configuration — single source for runtime + UI. */
export async function loadMctbWorkspaceConfig(
  workspaceId: string,
  input?: {
    callerE164?: string;
    transovoNumberE164?: string;
    forceDemoMode?: boolean;
  },
): Promise<MctbWorkspaceConfig> {
  const prisma = getPrisma();
  const [runtime, consentMode, prompt, ws, onboarding] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMctbConsentMode(workspaceId),
    loadMctbConsentPrompt(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    }),
    loadMctbOnboardingState(workspaceId),
  ]);

  const attestation = readAttestation(ws?.customFieldsConfig);
  const attestationValidation = await validateExistingConsentAttestation(workspaceId);

  let providerPhoneNumber: string | null = null;
  if (runtime.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: runtime.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    providerPhoneNumber = pn?.e164 || null;
  }

  const transovoNumber = input?.transovoNumberE164 || providerPhoneNumber || "";
  const demoMode = resolveRuntimeDemoMode({
    workspaceId,
    transovoNumberE164: transovoNumber,
    callerE164: input?.callerE164 || "",
    forceDemoMode: input?.forceDemoMode,
    demoSession: onboarding.demoSession,
  });

  const greetingAssetId =
    prompt.publishedAudioAssetId || prompt.audioAssetId || null;

  return {
    workspaceId,
    enabled: runtime.enabled,
    status: deriveStatus({
      enabled: runtime.enabled,
      runtime,
      attestationValid: attestationValidation.valid,
      consentMode,
    }),
    phoneNumberId: runtime.phoneNumberId,
    providerPhoneNumber,
    consentMode,
    greetingAssetId,
    greetingAudioUrl: null,
    greetingVersion: prompt.publishedVersion ?? null,
    confirmationAssetId: null,
    recoveryMessage: runtime.messageTemplate,
    smsDelaySeconds: demoMode ? 0 : runtime.delaySeconds,
    demoMode,
    cooldownSeconds: runtime.cooldownMinutes * 60,
    existingConsentAttested: attestationValidation.valid,
    existingConsentAttestedAt: attestation?.attestedAt || null,
    existingConsentAttestedBy: attestation?.attestedByUserId || null,
    existingConsentVersion: attestation?.version || null,
    runtime,
  };
}
