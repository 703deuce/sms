import "server-only";

import { getPrisma } from "@/lib/db";
import { mediaUrlsFromCampaignConfig } from "@/lib/mass-texting/mms";

export function massTextProductConfigPatch(
  configJson: unknown,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    configJson && typeof configJson === "object"
      ? { ...(configJson as Record<string, unknown>) }
      : {};
  return { ...base, productSource: "mass_text", massTexting: true, ...(extra || {}) };
}

export function campaignConfigIsMassText(configJson: unknown): boolean {
  const config =
    configJson && typeof configJson === "object"
      ? (configJson as Record<string, unknown>)
      : {};
  return config.productSource === "mass_text" || config.massTexting === true;
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
    select: { configJson: true },
  });
  if (!campaign) return false;
  return campaignConfigIsMassText(campaign.configJson);
}

export function getCampaignMediaUrls(configJson: unknown): string[] {
  return mediaUrlsFromCampaignConfig(configJson);
}

export function isCampaignMms(configJson: unknown): boolean {
  return getCampaignMediaUrls(configJson).length > 0;
}

export async function estimateMessageSegments(body: string): Promise<number> {
  const { estimateSmsSegments } = await import("@/lib/utils");
  return Math.max(1, estimateSmsSegments(body).segments);
}
