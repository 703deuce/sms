"use client";

import { Suspense } from "react";
import {
  CampaignsFilteredView,
  isRecurringCampaignRow,
} from "@/components/campaigns/campaigns-filtered-view";

export default function CampaignRecurringPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFilteredView
        title="Recurring campaigns"
        subtitle="Automated sends that repeat on a schedule."
        defaultFilter="scheduled"
        rowFilter={isRecurringCampaignRow}
      />
    </Suspense>
  );
}
