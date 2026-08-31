"use client";

import { Suspense } from "react";
import ContactsFlow from "@/components/kimi/contacts/ContactsFlow";

export default function ContactImportsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-contacts text-foreground">
        <ContactsFlow initialView="import" />
      </div>
    </Suspense>
  );
}
