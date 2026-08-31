"use client";

import { Suspense } from "react";
import { KimiCampaignsConnected } from "@/components/campaigns/kimi-campaigns-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-campaigns">
        <KimiCampaignsConnected initialView="create" />
      </div>
    </Suspense>
  );
}
