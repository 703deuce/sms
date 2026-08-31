"use client";

import { Suspense } from "react";
import { KimiKeywordsConnected } from "@/components/grow/kimi-keywords-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-keywords">
        <KimiKeywordsConnected />
      </div>
    </Suspense>
  );
}
