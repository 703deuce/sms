"use client";

import { Suspense } from "react";
import MessagingMediaFlow from "@/components/kimi/messaging-media/MessagingMediaFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-messaging-media">
        <MessagingMediaFlow />
      </div>
    </Suspense>
  );
}
