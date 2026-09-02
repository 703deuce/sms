"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignFailedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Failed campaigns"
        subtitle="Campaigns that did not complete successfully."
        defaultFilter="failed"
        fetchStatus="failed"
        lockFilter
        rowFilter={(row) => statusRowFilter("failed")(row)}
      />
    </Suspense>
  );
}
