"use client";

import { Suspense } from "react";
import GrowQrCodesFlow from "@/components/kimi/grow-qr-codes/GrowQrCodesFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-grow-qr-codes text-foreground">
        <GrowQrCodesFlow />
      </div>
    </Suspense>
  );
}
