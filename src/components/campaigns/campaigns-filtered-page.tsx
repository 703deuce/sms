import { CampaignsFilteredView } from "@/components/campaigns/campaigns-filtered-view";
import {
  filterCampaignRows,
  type CampaignRowFilterKey,
} from "@/lib/campaigns/campaign-list-filters";
import { mapBroadcastRowToListRow, type CampaignListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listBroadcastCampaigns } from "@/lib/mass-texting/broadcast/service";

type Props = {
  title: string;
  subtitle: string;
  defaultFilter?: string;
  fetchStatus?: string;
  lockFilter?: boolean;
  rowFilterKey?: CampaignRowFilterKey;
};

export async function CampaignsFilteredPage({
  title,
  subtitle,
  defaultFilter = "all",
  fetchStatus,
  lockFilter = false,
  rowFilterKey,
}: Props) {
  const workspaceId = await getActiveWorkspaceId();
  let initialRows: CampaignListRow[] = [];
  if (workspaceId) {
    const rows = await listBroadcastCampaigns(workspaceId, { take: 200, status: fetchStatus });
    const mapped = rows.map(mapBroadcastRowToListRow);
    initialRows = filterCampaignRows(mapped, rowFilterKey);
  }

  return (
    <CampaignsFilteredView
      title={title}
      subtitle={subtitle}
      defaultFilter={defaultFilter}
      fetchStatus={fetchStatus}
      lockFilter={lockFilter}
      rowFilterKey={rowFilterKey}
      initialRows={initialRows}
    />
  );
}

export type { CampaignRowFilterKey } from "@/lib/campaigns/campaign-list-filters";
