"use client";

import { Suspense } from "react";
import ContactsListsFlow from "@/components/kimi/contacts-lists/ContactsListsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-contacts-lists text-foreground">
        <ContactsListsFlow />
      </div>
    </Suspense>
  );
}
