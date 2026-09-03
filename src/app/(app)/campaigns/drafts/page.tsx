import { Suspense } from "react";
import { CampaignsFilteredPage, statusRowFilter } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignDraftsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Draft campaigns"
        subtitle="Campaigns saved but not yet scheduled or sent."
        defaultFilter="draft"
        fetchStatus="draft"
        lockFilter
        rowFilter={statusRowFilter("draft")}
      />
    </Suspense>
  );
}
