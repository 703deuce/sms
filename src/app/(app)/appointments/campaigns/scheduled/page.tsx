import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignScheduledPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Scheduled campaigns"
        subtitle="Upcoming sends queued for delivery."
        defaultFilter="scheduled"
        fetchStatus="scheduled"
        lockFilter
        rowFilterKey="scheduled"
      />
    </Suspense>
  );
}
