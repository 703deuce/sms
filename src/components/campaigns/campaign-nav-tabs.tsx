"use client";

import { Tabs } from "@/components/ui/tabs";
import { getClientCampaignTabs } from "@/lib/campaign-tabs";
import { useCampaignsBasePath } from "@/hooks/use-campaigns-base-path";

export function CampaignNavTabs() {
  const basePath = useCampaignsBasePath();
  return <Tabs items={getClientCampaignTabs(basePath)} />;
}
