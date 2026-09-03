import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignRecurringPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Recurring campaigns"
        subtitle="Automated sends that repeat on a schedule."
        defaultFilter="all"
        lockFilter
        rowFilterKey="recurring"
      />
    </Suspense>
  );
}
