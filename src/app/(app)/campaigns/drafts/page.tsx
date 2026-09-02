"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignDraftsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
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
