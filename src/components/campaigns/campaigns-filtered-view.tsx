"use client";

import type { CampaignRowFilterKey } from "@/lib/campaigns/campaign-list-filters";
import {
  campaignRowMatchesFilter,
  filterCampaignRows,
} from "@/lib/campaigns/campaign-list-filters";
import type { CampaignListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { CampaignsConnectedOpus } from "@/newui-transplant/connected/campaigns/campaigns-connected-opus";
import { useMemo } from "react";

export function CampaignsFilteredView({
  title,
  subtitle,
  defaultFilter = "all",
  rowFilterKey,
  fetchStatus,
  lockFilter = false,
  initialRows = [],
}: {
  title: string;
  subtitle: string;
  defaultFilter?: string;
  rowFilterKey?: CampaignRowFilterKey;
  fetchStatus?: string;
  lockFilter?: boolean;
  initialRows?: CampaignListRow[];
}) {
  const rowFilter = useMemo(() => {
    if (!rowFilterKey) return undefined;
    return (row: CampaignListRow) => campaignRowMatchesFilter(row, rowFilterKey);
  }, [rowFilterKey]);

  return (
    <CampaignsConnectedOpus
      listTitle={title}
      listSubtitle={subtitle}
      defaultFilter={defaultFilter}
      lockFilter={lockFilter}
      rowFilter={rowFilter}
      fetchStatus={fetchStatus}
      initialRows={filterCampaignRows(initialRows, rowFilterKey)}
    />
  );
}

export { filterCampaignRows, isRecurringCampaignRow, statusRowFilter } from "@/lib/campaigns/campaign-list-filters";
