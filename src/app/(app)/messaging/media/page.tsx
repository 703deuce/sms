"use client";

import { Suspense } from "react";
import { KimiMediaConnected } from "@/components/messaging/kimi-media-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-messaging-media">
        <KimiMediaConnected />
      </div>
    </Suspense>
  );
}
