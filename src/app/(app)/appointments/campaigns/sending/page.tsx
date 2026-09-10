import { Suspense } from "react";
import { CampaignsFilteredPage } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignSendingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Sending campaigns"
        subtitle="Campaigns currently delivering messages."
        defaultFilter="sending"
        fetchStatus="sending"
        lockFilter
        rowFilterKey="sending"
      />
    </Suspense>
  );
}
