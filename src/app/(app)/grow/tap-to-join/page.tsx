"use client";

import { Suspense } from "react";
import GrowTapToJoinFlow from "@/components/kimi/grow-tap-to-join/GrowTapToJoinFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-grow-tap-to-join text-foreground">
        <GrowTapToJoinFlow />
      </div>
    </Suspense>
  );
}
