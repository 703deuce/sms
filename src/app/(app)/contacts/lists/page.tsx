"use client";

import { Suspense } from "react";
import { KimiListsConnected } from "@/components/contacts/kimi-lists-connected";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts-lists">
        <KimiListsConnected />
      </div>
    </Suspense>
  );
}
