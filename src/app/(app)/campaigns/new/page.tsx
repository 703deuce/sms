"use client";

import { CampaignComposeView } from "@/components/campaigns/broadcast/campaign-compose";
import { Suspense } from "react";

export default function CreateCampaignPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignComposeView />
    </Suspense>
  );
}
