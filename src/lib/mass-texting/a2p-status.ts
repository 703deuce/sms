import "server-only";

import { getPrisma } from "@/lib/db";
import type { MessagingRegistration } from "@/lib/domain";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import { isProviderA2pApproved } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import {
  getMessagingProductRegistration,
  reconcileMassTextMessagingRegistration,
} from "@/lib/mass-texting/messaging-registration";

export function isMassTextA2pApprovedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || "").toLowerCase();
  return normalized === "approved" || normalized === "certified" || normalized === "ready";
}

function workspaceRegistrationOverallStatus(
  overallStatus: string | null | undefined,
): string {
  if (isMassTextA2pApprovedStatus(overallStatus)) {
    return overallStatus === "ready" ? "approved" : String(overallStatus);
  }
  return "approved";
}

async function isWorkspaceMessagingReadyForMassText(
  workspaceId: string,
  workspaceReg: MessagingRegistration,
): Promise<boolean> {
  if (isProviderA2pApproved(workspaceReg)) return true;

  const status = String(workspaceReg.overallStatus || "").toLowerCase();
  if (
    workspaceReg.messagingEnabled &&
    workspaceReg.phoneAttached &&
    workspaceReg.phoneE164 &&
    (status === "ready" || status === "approved")
  ) {
    return true;
  }

  if (!workspaceReg.phoneE164) return false;
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: workspaceReg.phoneE164, status: { not: "Released" } },
    select: { settingsJson: true, a2pStatus: true, type: true },
  });
  return Boolean(phone && isPhoneMessagingApproved(phone));
}

/**
 * Mirror workspace A2P approval (MCTB / shared Telnyx registration) into the Mass
 * Texting product registration row when the workspace is already messaging-ready.
 */
export async function syncMassTextA2pFromWorkspaceRegistration(workspaceId: string) {
  const existing = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  if (
    existing &&
    isMassTextA2pApprovedStatus(existing.overallStatus) &&
    existing.messagingEnabled &&
    existing.phoneAttached
  ) {
    return existing;
  }

  const workspaceReg = await getRegistrationByWorkspace(workspaceId);
  if (!workspaceReg || !(await isWorkspaceMessagingReadyForMassText(workspaceId, workspaceReg))) {
    return existing;
  }
  if (!workspaceReg.phoneE164 || !workspaceReg.phoneAttached) {
    return existing;
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: workspaceReg.phoneE164, status: { not: "Released" } },
    select: { id: true },
  });

  return reconcileMassTextMessagingRegistration({
    workspaceId,
    overallStatus: workspaceRegistrationOverallStatus(workspaceReg.overallStatus),
    messagingEnabled: true,
    phoneAttached: true,
    phoneE164: workspaceReg.phoneE164,
    phoneNumberId: phone?.id ?? existing?.phoneNumberId ?? null,
    brandId: workspaceReg.brandId ?? existing?.brandId ?? null,
    campaignId: workspaceReg.a2pCampaignSid ?? existing?.campaignId ?? null,
  });
}

export async function resolveMassTextA2pStatus(workspaceId: string): Promise<string> {
  const reg = await syncMassTextA2pFromWorkspaceRegistration(workspaceId);
  return reg?.overallStatus ?? "not_started";
}
