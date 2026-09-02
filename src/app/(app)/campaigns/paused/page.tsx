"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignPausedPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Paused campaigns"
        subtitle="Campaigns temporarily stopped mid-send."
        defaultFilter="paused"
        fetchStatus="paused"
        lockFilter
        rowFilter={statusRowFilter("paused")}
      />
    </Suspense>
  );
}
