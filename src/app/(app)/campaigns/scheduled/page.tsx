"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  statusRowFilter,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignScheduledPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Scheduled campaigns"
        subtitle="Upcoming sends queued for delivery."
        defaultFilter="scheduled"
        lockFilter
        rowFilter={statusRowFilter("scheduled")}
      />
    </Suspense>
  );
}
