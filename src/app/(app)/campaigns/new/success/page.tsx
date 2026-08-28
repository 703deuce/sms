"use client";

import { CampaignSuccessView } from "@/components/campaigns/broadcast/campaign-confirmation";
import { Suspense } from "react";

export default function CampaignSuccessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignSuccessView />
    </Suspense>
  );
}
