import type { CampaignCategory } from "@/lib/campaigns/catalog";

/** Route playbook cards to Campaign composer or Automation builder. */
export function playbookHref(category: CampaignCategory): string {
  if (category.engine === "broadcast") {
    return `/campaigns/new?playbook=${category.id}`;
  }
  if (category.engine === "automation") {
    return `/automations/new?playbook=${category.id}`;
  }
  return `/campaigns/new/${category.id}`;
}
