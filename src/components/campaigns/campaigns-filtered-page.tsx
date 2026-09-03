import { CampaignsFilteredView, statusRowFilter } from "@/components/campaigns/campaigns-filtered-view";
import { mapBroadcastRowToListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listBroadcastCampaigns } from "@/lib/mass-texting/broadcast/service";
import type { CampaignListRow } from "@/lib/campaigns/kimi-campaigns-adapter";

type Props = {
  title: string;
  subtitle: string;
  defaultFilter?: string;
  fetchStatus?: string;
  lockFilter?: boolean;
  rowFilter?: (row: CampaignListRow) => boolean;
};

export async function CampaignsFilteredPage({
  title,
  subtitle,
  defaultFilter = "all",
  fetchStatus,
  lockFilter = false,
  rowFilter,
}: Props) {
  const workspaceId = await getActiveWorkspaceId();
  let initialRows: CampaignListRow[] = [];
  if (workspaceId) {
    const rows = await listBroadcastCampaigns(workspaceId, { take: 200, status: fetchStatus });
    const mapped = rows.map(mapBroadcastRowToListRow);
    initialRows = rowFilter ? mapped.filter(rowFilter) : mapped;
  }

  return (
    <CampaignsFilteredView
      title={title}
      subtitle={subtitle}
      defaultFilter={defaultFilter}
      fetchStatus={fetchStatus}
      lockFilter={lockFilter}
      rowFilter={rowFilter}
      initialRows={initialRows}
    />
  );
}

export { statusRowFilter, isRecurringCampaignRow } from "@/components/campaigns/campaigns-filtered-view";
