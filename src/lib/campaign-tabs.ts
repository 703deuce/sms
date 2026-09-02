import { MASS_TEXT_RECURRING_PRODUCTION_ENABLED } from "@/lib/mass-texting/constants";

export const campaignTabs = [
  { label: "All", href: "/campaigns" },
  { label: "Drafts", href: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled" },
  { label: "Completed", href: "/campaigns/completed" },
  { label: "Failed", href: "/campaigns/failed" },
];

export const campaignTabsWithRecurring = [
  ...campaignTabs,
  { label: "Sending", href: "/campaigns/sending" },
  { label: "Recurring", href: "/campaigns/recurring" },
  { label: "Calendar", href: "/campaigns/calendar" },
];

export function getClientCampaignTabs() {
  return MASS_TEXT_RECURRING_PRODUCTION_ENABLED ? campaignTabsWithRecurring : campaignTabs;
}

export async function getCampaignTabs(workspaceId: string) {
  const { getWorkspaceProductFeatures } = await import("@/lib/products/feature-entitlements");
  const { isActiveEntitlement } = await import("@/lib/products/types");
  const features = await getWorkspaceProductFeatures(workspaceId);
  const massTexting = isActiveEntitlement(features.mass_texting);
  if (!massTexting) return campaignTabs;
  return getClientCampaignTabs();
}
