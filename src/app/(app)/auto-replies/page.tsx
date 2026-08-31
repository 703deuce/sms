"use client";

import { Suspense } from "react";
import AutoRepliesFlow from "@/components/kimi/auto-replies/AutoRepliesFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-auto-replies text-foreground">
        <AutoRepliesFlow />
      </div>
    </Suspense>
  );
}
