"use client";

import CampaignsFlow from "@/components/kimi/campaigns/CampaignsFlow";
import { Suspense } from "react";

export default function CreateCampaignPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <CampaignsFlow initialView="create" />
    </Suspense>
  );
}
