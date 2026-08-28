"use client";

import { CampaignReviewView } from "@/components/campaigns/broadcast/campaign-review";
import { Suspense } from "react";

export default function CampaignReviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignReviewView />
    </Suspense>
  );
}
