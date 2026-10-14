"use client";

import { CampaignQueueView } from "@/components/campaigns/broadcast/campaign-confirmation";
import { CampaignsOpusShell } from "@/newui-transplant/connected/campaigns/campaigns-opus-shell";
import { Suspense } from "react";

export default function CampaignQueuePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
      <CampaignsOpusShell wide>
        <CampaignQueueView />
      </CampaignsOpusShell>
    </Suspense>
  );
}
