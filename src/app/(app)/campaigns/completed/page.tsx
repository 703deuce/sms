"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignCompletedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Completed campaigns"
        subtitle="Campaigns that finished sending."
        defaultFilter="completed"
        lockFilter
        rowFilter={(row) => {
          const status = statusRowFilter("completed")(row);
          const sent = statusRowFilter("sent")(row);
          return status || sent;
        }}
      />
    </Suspense>
  );
}
