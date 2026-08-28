"use client";

import { CampaignQueueView } from "@/components/campaigns/broadcast/campaign-confirmation";
import { Suspense } from "react";

export default function CampaignQueuePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignQueueView />
    </Suspense>
  );
}
