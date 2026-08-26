export const campaignTabs = [
  { label: "Create", href: "/campaigns" },
  { label: "All Campaigns", href: "/campaigns/all" },
  { label: "Drafts", href: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled" },
  { label: "Calendar", href: "/campaigns/calendar" },
  { label: "Completed", href: "/campaigns/completed" },
  { label: "Failed", href: "/campaigns/failed" },
];

/** Recurring is not a Mass Texting V1 production path. Kept for other campaign products. */
export const campaignTabsWithRecurring = [
  ...campaignTabs,
  { label: "Recurring", href: "/campaigns/recurring" },
];
