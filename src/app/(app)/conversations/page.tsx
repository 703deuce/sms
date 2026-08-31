"use client";

import { Suspense } from "react";
import ConversationsFlow from "@/components/kimi/conversations/ConversationsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-conversations">
        <ConversationsFlow />
      </div>
    </Suspense>
  );
}
