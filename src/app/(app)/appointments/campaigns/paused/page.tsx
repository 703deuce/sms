import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignPausedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Paused campaigns"
        subtitle="Campaigns paused before completion."
        defaultFilter="paused"
        fetchStatus="paused"
        lockFilter
        rowFilterKey="paused"
      />
    </Suspense>
  );
}
