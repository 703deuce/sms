import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignFailedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Failed campaigns"
        subtitle="Campaigns that failed to send."
        defaultFilter="failed"
        fetchStatus="failed"
        lockFilter
        rowFilterKey="failed"
      />
    </Suspense>
  );
}
