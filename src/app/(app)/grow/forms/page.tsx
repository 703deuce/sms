"use client";

import { Suspense } from "react";
import { KimiFormsConnected } from "@/components/grow/kimi-forms-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-forms">
        <KimiFormsConnected />
      </div>
    </Suspense>
  );
}
