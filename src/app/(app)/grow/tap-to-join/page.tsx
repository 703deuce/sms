"use client";

import { Suspense } from "react";
import { KimiTapToJoinConnected } from "@/components/grow/kimi-tap-to-join-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-tap-to-join">
        <KimiTapToJoinConnected />
      </div>
    </Suspense>
  );
}
