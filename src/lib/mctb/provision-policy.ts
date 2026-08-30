import { getPrisma } from "@/lib/db";
import {
  assertNotMctbLockedForGenericVoiceProvision,
  isMctbTexmlIngressLocked,
  MctbTexmlProvisionLockedError,
} from "@/lib/mctb/sip-ingress/sync";
import { MCTB_CANONICAL_PROVISION_ENTRY } from "@/lib/mctb/texml-ingress/frozen-pipeline";

export {
  assertNotMctbLockedForGenericVoiceProvision,
  MCTB_CANONICAL_PROVISION_ENTRY,
  MctbTexmlProvisionLockedError,
};

/** @deprecated Use MctbTexmlProvisionLockedError */
export const MctbProvisionPolicyError = MctbTexmlProvisionLockedError;

type WorkspacePhoneRow = {
  id: string;
  e164: string;
  provider: string | null;
  providerNumberId: string | null;
  settingsJson: unknown;
  status: string | null;
  workspaceId: string;
};

/**
 * Resolve a phone row strictly for the requesting workspace.
 * Platform demo shared DIDs may be owned by another workspace when explicitly authorized.
 */
export async function resolveMctbProvisionPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<WorkspacePhoneRow | null> {
  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: {
      id: true,
      e164: true,
      provider: true,
      providerNumberId: true,
      settingsJson: true,
      status: true,
      workspaceId: true,
    },
  });
  if (owned) return owned;

  return null;
}

export async function assertMctbProvisionPhoneInWorkspace(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<WorkspacePhoneRow> {
  const phone = await resolveMctbProvisionPhone(input);
  if (!phone?.e164) {
    throw new Error(
      `phone_not_in_workspace: ${input.phoneNumberId} is not available for workspace ${input.workspaceId}`,
    );
  }
  return phone;
}

export function isMctbVoiceProvisionLocked(settingsJson: unknown): boolean {
  return isMctbTexmlIngressLocked(settingsJson);
}
