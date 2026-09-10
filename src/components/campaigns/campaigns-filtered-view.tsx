"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { useCampaignsBasePath, useCampaignsPath } from "@/hooks/use-campaigns-base-path";
import type { CampaignRowFilterKey } from "@/lib/campaigns/campaign-list-filters";
import {
  campaignRowMatchesFilter,
  filterCampaignRows,
} from "@/lib/campaigns/campaign-list-filters";
import type { CampaignListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";
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
  const router = useRouter();
  const campaignsBasePath = useCampaignsBasePath();
  const campaignsNewPath = useCampaignsPath("/new");
  const rowFilter = useMemo(() => {
    if (!rowFilterKey) return undefined;
    return (row: CampaignListRow) => campaignRowMatchesFilter(row, rowFilterKey);
  }, [rowFilterKey]);

  return (
    <div className="kimi-surface kimi-campaigns">
      <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
        <CampaignNavTabs />
      </div>
      <CampaignsList
        title={title}
        subtitle={subtitle}
        defaultFilter={defaultFilter}
        lockFilter={lockFilter}
        rowFilter={rowFilter}
        fetchStatus={fetchStatus}
        initialRows={filterCampaignRows(initialRows, rowFilterKey)}
        campaignsBasePath={campaignsBasePath}
        onCreate={() => {
          startFreshComposeDraft();
          router.push(campaignsNewPath);
        }}
      />
    </div>
  );
}

export { filterCampaignRows, isRecurringCampaignRow, statusRowFilter } from "@/lib/campaigns/campaign-list-filters";
