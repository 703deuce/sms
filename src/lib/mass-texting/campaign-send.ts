import "server-only";

import { getPrisma } from "@/lib/db";

export function massTextProductConfigPatch(
  configJson: unknown,
): Record<string, unknown> {
  const base =
    configJson && typeof configJson === "object"
      ? { ...(configJson as Record<string, unknown>) }
      : {};
  return { ...base, productSource: "mass_text", massTexting: true };
}

/** True when campaign was launched through Mass Texting or explicitly tagged. */
export async function isMassTextingCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const audit = await prisma.campaignLaunchAudit.findFirst({
    where: { workspaceId, campaignId },
    select: { id: true },
  });
  if (audit) return true;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { configJson: true, type: true, category: true },
  });
  if (!campaign) return false;
  const config =
    campaign.configJson && typeof campaign.configJson === "object"
      ? (campaign.configJson as Record<string, unknown>)
      : {};
  if (config.productSource === "mass_text" || config.massTexting === true) return true;

  const entitled = await import("@/lib/mass-texting/access").then((m) =>
    m.isMassTextingWorkspace(workspaceId),
  );
  if (!entitled) return false;

  const type = String(campaign.type || "").toLowerCase();
  const category = String(campaign.category || "").toLowerCase();
  return (
    type.includes("promotional") ||
    type.includes("broadcast") ||
    category.includes("broadcast") ||
    category.includes("promotional")
  );
}

export function getCampaignMediaUrls(configJson: unknown): string[] {
  const config =
    configJson && typeof configJson === "object"
      ? (configJson as Record<string, unknown>)
      : {};
  const urls = config.mediaUrls;
  if (!Array.isArray(urls)) return [];
  return urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export function isCampaignMms(configJson: unknown): boolean {
  return getCampaignMediaUrls(configJson).length > 0;
}

export async function estimateMessageSegments(body: string): Promise<number> {
  const { estimateSmsSegments } = await import("@/lib/utils");
  return Math.max(1, estimateSmsSegments(body).segments);
}
