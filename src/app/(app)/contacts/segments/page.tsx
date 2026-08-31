"use client";

import { Suspense } from "react";
import ContactsSegmentsFlow from "@/components/kimi/contacts-segments/ContactsSegmentsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts-segments">
        <ContactsSegmentsFlow />
      </div>
    </Suspense>
  );
}
