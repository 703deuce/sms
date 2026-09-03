import { DripCampaignsList } from "@/components/drip-campaigns/drip-campaigns-list";
import { Tabs } from "@/components/ui/tabs";
import { DRIP_SECTION_NAV_TABS } from "@/lib/drip-campaigns/routes";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listDripCampaigns } from "@/lib/drip-campaigns/service";

export default async function AutomationsDripCampaignsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listDripCampaigns(workspaceId) : [];

  return (
    <div>
      <Tabs items={[...DRIP_SECTION_NAV_TABS]} />
      <DripCampaignsList initialRows={rows} embedded />
    </div>
  );
}
