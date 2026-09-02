"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import {
  normalizeCampaignStatus,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

export function CampaignsFilteredView({
  title,
  subtitle,
  defaultFilter = "all",
  rowFilter,
  lockFilter = false,
}: {
  title: string;
  subtitle: string;
  defaultFilter?: string;
  rowFilter?: (row: CampaignListRow) => boolean;
  lockFilter?: boolean;
}) {
  const router = useRouter();

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
        onCreate={() => {
          startFreshComposeDraft();
          router.push("/campaigns/new");
        }}
      />
    </div>
  );
}

export function isRecurringCampaignRow(row: CampaignListRow): boolean {
  if (!row.configJson || typeof row.configJson !== "object") return false;
  const config = row.configJson as Record<string, unknown>;
  return config.scheduleMode === "recurring" && Boolean(config.recurrence);
}

export function statusRowFilter(status: string) {
  return (row: CampaignListRow) => normalizeCampaignStatus(row.status) === status;
}
