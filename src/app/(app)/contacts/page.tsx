"use client";

import { Suspense } from "react";
import ContactsFlow from "@/components/kimi/contacts/ContactsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts">
        <ContactsFlow />
      </div>
    </Suspense>
  );
}
