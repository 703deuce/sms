"use client";

import { Tabs } from "@/components/ui/tabs";
import { getClientCampaignTabs } from "@/lib/campaign-tabs";

export function CampaignNavTabs() {
  return <Tabs items={getClientCampaignTabs()} />;
}
