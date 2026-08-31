"use client";

import { Suspense } from "react";
import CampaignsUiFlow from "@/components/kimi/campaigns/CampaignsUiFlow";

export default function ReviewCampaignPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-campaigns">
        <CampaignsUiFlow initialView="create" />
      </div>
    </Suspense>
  );
}
