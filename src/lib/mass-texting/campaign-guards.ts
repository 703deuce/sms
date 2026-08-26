import "server-only";

import { getPrisma } from "@/lib/db";
import { isMassTextingWorkspace } from "@/lib/mass-texting/access";

export async function campaignHasLaunchAudit(
  workspaceId: string,
  campaignId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const audit = await prisma.campaignLaunchAudit.findFirst({
    where: { workspaceId, campaignId },
    select: { id: true },
  });
  return Boolean(audit);
}

export async function massTextingRequiresLaunchAudit(
  workspaceId: string,
): Promise<boolean> {
  return isMassTextingWorkspace(workspaceId);
}

export async function canLegacyActivateCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!(await massTextingRequiresLaunchAudit(workspaceId))) {
    return { allowed: true };
  }
  if (await campaignHasLaunchAudit(workspaceId, campaignId)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      "Mass Texting campaigns must be launched through pre-send review (credits, A2P, and suppression checks).",
  };
}

export async function canAutoActivateScheduledCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<boolean> {
  if (!(await massTextingRequiresLaunchAudit(workspaceId))) {
    return true;
  }
  return campaignHasLaunchAudit(workspaceId, campaignId);
}
