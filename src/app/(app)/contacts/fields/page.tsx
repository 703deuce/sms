"use client";

import { Suspense } from "react";
import ContactsFieldsFlow from "@/components/kimi/contacts-fields/ContactsFieldsFlow";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-contacts-fields text-foreground">
        <ContactsFieldsFlow />
      </div>
    </Suspense>
  );
}
