import { Suspense } from "react";
import { CampaignsFilteredPage, statusRowFilter } from "@/components/campaigns/campaigns-filtered-page";

export default function CampaignSendingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredPage
        title="Sending campaigns"
        subtitle="Campaigns currently delivering messages."
        defaultFilter="sending"
        fetchStatus="sending"
        lockFilter
        rowFilter={(row) => {
          const sending = statusRowFilter("sending")(row);
          const queued = statusRowFilter("queued")(row);
          return sending || queued;
        }}
      />
    </Suspense>
  );
}
