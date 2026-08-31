import { DripCampaignsList } from "@/components/drip-campaigns/drip-campaigns-list";
import { Tabs } from "@/components/ui/tabs";
import { AUTOMATION_NAV_TABS } from "@/lib/automations/nav-tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listDripCampaigns } from "@/lib/drip-campaigns/service";

export default async function AutomationsDripCampaignsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listDripCampaigns(workspaceId) : [];

  return (
    <div>
      <Tabs items={[...AUTOMATION_NAV_TABS]} />
      <DripCampaignsList initialRows={rows} embedded />
    </div>
  );
}
