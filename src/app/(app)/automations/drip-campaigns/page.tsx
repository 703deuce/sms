import { DripCampaignsList } from "@/components/drip-campaigns/drip-campaigns-list";
import { DripSectionShell } from "@/components/drip-campaigns/drip-section-shell";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listDripCampaigns } from "@/lib/drip-campaigns/service";

export default async function AutomationsDripCampaignsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listDripCampaigns(workspaceId) : [];

  return (
    <DripSectionShell>
      <DripCampaignsList initialRows={rows} embedded />
    </DripSectionShell>
  );
}
