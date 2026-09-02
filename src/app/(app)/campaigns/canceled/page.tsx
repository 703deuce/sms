"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignCanceledPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Canceled campaigns"
        subtitle="Campaigns stopped before completion."
        defaultFilter="canceled"
        fetchStatus="canceled"
        lockFilter
        rowFilter={(row) => {
          const canceled = statusRowFilter("canceled")(row);
          const cancelled = statusRowFilter("cancelled")(row);
          return canceled || cancelled;
        }}
      />
    </Suspense>
  );
}
