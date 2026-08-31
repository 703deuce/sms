"use client";

import CampaignsUiFlow from "@/components/kimi/campaigns/CampaignsUiFlow";
import { Suspense } from "react";

export default function CampaignReviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-campaigns text-foreground">
        <CampaignsUiFlow initialView="review" />
      </div>
    </Suspense>
  );
}
