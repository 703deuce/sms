"use client";

import { Suspense } from "react";
import GrowFormsFlow from "@/components/kimi/grow-forms/GrowFormsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-forms">
        <GrowFormsFlow />
      </div>
    </Suspense>
  );
}
