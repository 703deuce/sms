import "server-only";

import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getPlatformDemoNumberE164 } from "@/lib/mctb/onboarding/demo";
import {
  isWorkspaceListedForPlatformDemoAccess,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access-shared";

export { readAdminTestWorkspaceIds } from "@/lib/mctb/platform-demo-access-shared";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type PlatformDemoPhoneLink = {
  phoneNumberId: string;
  e164: string;
  ownerWorkspaceId: string;
  settingsJson: Record<string, unknown>;
};

export async function getPlatformDemoPhoneRecord(): Promise<PlatformDemoPhoneLink | null> {
  const e164 = getPlatformDemoNumberE164();
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      settingsJson: true,
      status: true,
    },
  });
  if (!pn || String(pn.status || "").toLowerCase() === "released") return null;
  return {
    phoneNumberId: pn.id,
    e164: pn.e164,
    ownerWorkspaceId: pn.workspaceId,
    settingsJson: asRecord(pn.settingsJson),
  };
}

/** Workspace may use 571 for production/setup testing without owning the DID row. */
export async function isWorkspaceAuthorizedForPlatformDemoNumber(
  workspaceId: string,
): Promise<boolean> {
  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) return false;
  return isWorkspaceListedForPlatformDemoAccess(
    workspaceId,
    pn.settingsJson,
    pn.ownerWorkspaceId,
  );
}

export async function linkWorkspaceToPlatformDemoNumber(input: {
  workspaceId: string;
  userEmail?: string | null;
}): Promise<{
  phoneNumberId: string;
  e164: string;
  ownerWorkspaceId: string;
  linkedWorkspaceId: string;
  alreadyLinked: boolean;
}> {
  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) {
    throw new Error(`Platform demo number ${MCTB_PLATFORM_DEMO_E164} not found in phone_numbers`);
  }

  const existing = readAdminTestWorkspaceIds(pn.settingsJson);
  const alreadyLinked =
    pn.ownerWorkspaceId === input.workspaceId || existing.includes(input.workspaceId);

  if (!alreadyLinked) {
    const prisma = getPrisma();
    const nextSettings = {
      ...pn.settingsJson,
      mctbRole: pn.settingsJson.mctbRole || "platform_demo",
      platformDemo: true,
      adminTestWorkspaceIds: [...new Set([...existing, input.workspaceId])],
      ...(input.userEmail ? { lastAdminLinkEmail: input.userEmail.toLowerCase() } : {}),
      lastAdminLinkAt: new Date().toISOString(),
    };
    await prisma.phoneNumber.update({
      where: { id: pn.phoneNumberId },
      data: { settingsJson: nextSettings },
    });
  }

  return {
    phoneNumberId: pn.phoneNumberId,
    e164: pn.e164,
    ownerWorkspaceId: pn.ownerWorkspaceId,
    linkedWorkspaceId: input.workspaceId,
    alreadyLinked,
  };
}

/** Remove a tenant from shared 571 access when they move to a dedicated MCTB DID. */
export async function unlinkWorkspaceFromPlatformDemoNumber(input: {
  workspaceId: string;
}): Promise<{ unlinked: boolean; remainingLinked: number }> {
  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) return { unlinked: false, remainingLinked: 0 };

  const existing = readAdminTestWorkspaceIds(pn.settingsJson);
  if (!existing.includes(input.workspaceId) && pn.ownerWorkspaceId !== input.workspaceId) {
    return { unlinked: false, remainingLinked: existing.length };
  }

  const nextIds = existing.filter((id) => id !== input.workspaceId);
  if (nextIds.length === existing.length && pn.ownerWorkspaceId !== input.workspaceId) {
    return { unlinked: false, remainingLinked: existing.length };
  }

  const prisma = getPrisma();
  const nextSettings = {
    ...pn.settingsJson,
    adminTestWorkspaceIds: nextIds,
    lastUnlinkAt: new Date().toISOString(),
    lastUnlinkedWorkspaceId: input.workspaceId,
  };
  await prisma.phoneNumber.update({
    where: { id: pn.phoneNumberId },
    data: { settingsJson: nextSettings },
  });

  return { unlinked: true, remainingLinked: nextIds.length };
}
