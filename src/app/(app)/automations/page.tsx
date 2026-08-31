"use client";

import { Suspense } from "react";
import AutomationsFlow from "@/components/kimi/automations/AutomationsFlow";

export default function AutomationsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <AutomationsFlow />
    </Suspense>
  );
}
