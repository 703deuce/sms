import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignCompletedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Completed campaigns"
        subtitle="Campaigns that finished sending."
        defaultFilter="completed"
        fetchStatus="completed"
        lockFilter
        rowFilterKey="completed"
      />
    </Suspense>
  );
}
