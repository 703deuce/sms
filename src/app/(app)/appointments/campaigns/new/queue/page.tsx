"use client";

import { CampaignQueueView } from "@/components/campaigns/broadcast/campaign-confirmation";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { Suspense } from "react";

export default function CampaignQueuePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-campaigns">
        <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
          <CampaignNavTabs />
        </div>
        <CampaignQueueView />
      </div>
    </Suspense>
  );
}
