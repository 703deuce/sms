export const campaignTabs = [
  { label: "All", href: "/campaigns" },
  { label: "Drafts", href: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled" },
  { label: "Completed", href: "/campaigns/completed" },
  { label: "Failed", href: "/campaigns/failed" },
];

/** Recurring is not a Mass Texting V1 production path. Kept for other campaign products. */
export const campaignTabsWithRecurring = [
  ...campaignTabs,
  { label: "Recurring", href: "/campaigns/recurring" },
];

export async function getCampaignTabs(workspaceId: string) {
  const { getWorkspaceProductFeatures } = await import("@/lib/products/feature-entitlements");
  const { isActiveEntitlement } = await import("@/lib/products/types");
  const features = await getWorkspaceProductFeatures(workspaceId);
  const massTexting = isActiveEntitlement(features.mass_texting);
  if (!massTexting) return campaignTabs;
  return campaignTabs.filter((tab) => tab.href !== "/campaigns/recurring");
}
