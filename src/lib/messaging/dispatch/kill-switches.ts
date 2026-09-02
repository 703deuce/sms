import "server-only";

import { getPrisma } from "@/lib/db";

export type DispatchGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; level: "platform" | "tenant" | "campaign" | "provider" };

/** Global platform kill switch — stops all new outbound dispatch. */
export function isPlatformDispatchPaused(): boolean {
  return (
    process.env.MESSAGING_OUTBOUND_PAUSED === "1" ||
    process.env.MESSAGING_OUTBOUND_PAUSED === "true" ||
    process.env.SMS_DISPATCH_PAUSED === "1" ||
    process.env.SMS_DISPATCH_PAUSED === "true"
  );
}

export function isProviderDispatchPaused(provider?: string): boolean {
  if (!provider) return false;
  const key = `SMS_DISPATCH_PAUSED_${provider.toUpperCase()}`;
  return process.env[key] === "1" || process.env[key] === "true";
}

export async function assertDispatchAllowed(input: {
  workspaceId: string;
  campaignId?: string;
  provider?: string;
}): Promise<DispatchGateResult> {
  if (isPlatformDispatchPaused()) {
    return { allowed: false, reason: "platform_dispatch_paused", level: "platform" };
  }
  if (isProviderDispatchPaused(input.provider)) {
    return { allowed: false, reason: "provider_dispatch_paused", level: "provider" };
  }

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { status: true, settingsJson: true },
  });
  if (!workspace) {
    return { allowed: false, reason: "workspace_not_found", level: "tenant" };
  }
  if (workspace.status === "Suspended" || workspace.status === "Canceled") {
    return { allowed: false, reason: "workspace_suspended", level: "tenant" };
  }

  const settings =
    workspace.settingsJson && typeof workspace.settingsJson === "object"
      ? (workspace.settingsJson as Record<string, unknown>)
      : {};
  if (settings.smsDispatchPaused === true || settings.messagingPaused === true) {
    return { allowed: false, reason: "tenant_dispatch_paused", level: "tenant" };
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, workspaceId: input.workspaceId },
      select: { status: true },
    });
    if (!campaign) {
      return { allowed: false, reason: "campaign_not_found", level: "campaign" };
    }
    if (!["SENDING"].includes(campaign.status)) {
      return { allowed: false, reason: `campaign_${campaign.status.toLowerCase()}`, level: "campaign" };
    }
  }

  return { allowed: true };
}
