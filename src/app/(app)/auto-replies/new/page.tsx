"use client";

import { Suspense } from "react";
import { KimiAutoRepliesConnected } from "@/components/auto-replies/kimi-auto-replies-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-auto-replies">
        <KimiAutoRepliesConnected initialView="keywords" />
      </div>
    </Suspense>
  );
}
