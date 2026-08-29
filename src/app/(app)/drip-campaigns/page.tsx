import { DripCampaignsList } from "@/components/drip-campaigns/drip-campaigns-list";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listDripCampaigns } from "@/lib/drip-campaigns/service";

export default async function DripCampaignsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listDripCampaigns(workspaceId) : [];
  return <DripCampaignsList initialRows={rows} />;
}
