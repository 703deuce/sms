import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignCanceledPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Canceled campaigns"
        subtitle="Scheduled campaigns that were canceled."
        defaultFilter="canceled"
        fetchStatus="canceled"
        lockFilter
        rowFilterKey="canceled"
      />
    </Suspense>
  );
}
