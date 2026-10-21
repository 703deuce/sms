import "server-only";

import { getPrisma } from "@/lib/server/db";
import { MCTB_CONSENT_MODE_EXISTING, normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";

export const EXISTING_CONSENT_ATTESTATION_VERSION = "1";

export type ExistingConsentAttestationRecord = {
  accepted: boolean;
  version: string;
  attestedByUserId: string;
  attestedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readExistingConsentAttestation(
  customFieldsConfig: unknown,
): ExistingConsentAttestationRecord | null {
  const mctb = asRecord(asRecord(customFieldsConfig).mctb);
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
  const customCfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(customCfg.mctb);

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

export async function loadMctbConsentMode(workspaceId: string) {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb = asRecord(asRecord(ws?.customFieldsConfig).mctb);
  return normalizeMctbConsentMode(mctb.consentMode ?? MCTB_CONSENT_MODE_EXISTING);
}

export async function validateExistingConsentAttestation(workspaceId: string): Promise<boolean> {
  const mode = await loadMctbConsentMode(workspaceId);
  if (mode !== MCTB_CONSENT_MODE_EXISTING) return true;
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  return Boolean(readExistingConsentAttestation(ws?.customFieldsConfig));
}
