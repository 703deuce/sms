"use client";

import { Suspense } from "react";
import GrowKeywordsFlow from "@/components/kimi/grow-keywords/GrowKeywordsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-keywords">
        <GrowKeywordsFlow />
      </div>
    </Suspense>
  );
}
