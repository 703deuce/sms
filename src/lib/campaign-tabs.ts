import { MASS_TEXT_RECURRING_PRODUCTION_ENABLED } from "@/lib/mass-texting/constants";
import {
  APPOINTMENTS_CAMPAIGNS_BASE,
  LEGACY_CAMPAIGNS_BASE,
  resolveCampaignsBasePath,
} from "@/lib/products/business-texting-routes";

function buildCampaignTabs(base: string) {
  return [
    { label: "All", href: base },
    { label: "Drafts", href: `${base}/drafts` },
    { label: "Scheduled", href: `${base}/scheduled` },
    { label: "Completed", href: `${base}/completed` },
    { label: "Failed", href: `${base}/failed` },
  ];
}

function buildCampaignTabsWithRecurring(base: string) {
  const tabs = buildCampaignTabs(base);
  return [
    ...tabs.slice(0, 4),
    { label: "Paused", href: `${base}/paused` },
    ...tabs.slice(4),
    { label: "Sending", href: `${base}/sending` },
    { label: "Recurring", href: `${base}/recurring` },
    { label: "Calendar", href: `${base}/calendar` },
  ];
}

/** @deprecated Use getClientCampaignTabs(basePath) */
export const campaignTabs = buildCampaignTabs(LEGACY_CAMPAIGNS_BASE);

/** @deprecated Use getClientCampaignTabs(basePath) */
export const campaignTabsWithRecurring = buildCampaignTabsWithRecurring(LEGACY_CAMPAIGNS_BASE);

export function getClientCampaignTabs(basePath?: string) {
  const base = basePath ?? resolveCampaignsBasePath();
  return MASS_TEXT_RECURRING_PRODUCTION_ENABLED
    ? buildCampaignTabsWithRecurring(base)
    : buildCampaignTabs(base);
}

export { APPOINTMENTS_CAMPAIGNS_BASE, LEGACY_CAMPAIGNS_BASE };

export async function getCampaignTabs(workspaceId: string) {
  const { getWorkspaceProductFeatures } = await import("@/lib/products/feature-entitlements");
  const { isActiveEntitlement } = await import("@/lib/products/types");
  const features = await getWorkspaceProductFeatures(workspaceId);
  const massTexting = isActiveEntitlement(features.mass_texting);
  if (!massTexting) return campaignTabs;
  return getClientCampaignTabs();
}
