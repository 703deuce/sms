"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignSendingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
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
