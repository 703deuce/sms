"use client";

import "./reference.css";
import { AppShell } from "./components/AppShell";
import { ContactHeader } from "./components/ContactHeader";
import { ContactProfileCard } from "./components/ContactProfileCard";
import { ContactAppointmentsPanel } from "./components/ContactAppointmentsPanel";
import { ContactActivityTimeline } from "./components/ContactActivityTimeline";
import { ConnectedRecordsPanel } from "./components/ConnectedRecordsPanel";
import { ContactProfileEdit } from "./components/ContactProfileEdit";
import { contact } from "./types";
import { ArrowLeft } from "lucide-react";

export default function ReferencePage() {
  return (
    <AppShell activeNav="Contacts">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <a
          href="#"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to contacts
        </a>

        <ContactHeader contact={contact} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Primary column */}
          <div className="min-w-0 space-y-6">
            <ContactAppointmentsPanel contactId={contact.id} />
            <ContactActivityTimeline contactId={contact.id} />
            <ConnectedRecordsPanel contactId={contact.id} />
          </div>

          {/* Context column */}
          <div className="space-y-6">
            <ContactProfileCard contact={contact} />
            <ContactProfileEdit
              contactId={contact.id}
              timezone={contact.timezone}
              linkedin={contact.linkedin}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
