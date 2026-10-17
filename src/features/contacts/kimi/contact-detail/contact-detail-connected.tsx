"use client";

import Link from "next/link";
import "@/components/contacts/kimi-ui/contact-detail/reference.css";
import { ContactHeader } from "@/components/contacts/kimi-ui/contact-detail/components/ContactHeader";
import { ContactProfileCard } from "@/components/contacts/kimi-ui/contact-detail/components/ContactProfileCard";
import { ContactAppointmentsPanel } from "@/components/contacts/kimi-ui/contact-detail/components/ContactAppointmentsPanel";
import { ContactActivityTimeline } from "@/components/contacts/kimi-ui/contact-detail/components/ContactActivityTimeline";
import { ConnectedRecordsPanel } from "@/components/contacts/kimi-ui/contact-detail/components/ConnectedRecordsPanel";
import { ContactVisualizerProjectsPanel } from "@/components/visualizer/contact-visualizer-projects-panel";
import { ContactProfileEdit } from "@/components/contacts/kimi-ui/contact-detail/components/ContactProfileEdit";
import type { Contact as KimiContact } from "@/components/contacts/kimi-ui/contact-detail/types";
import type { Contact } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

function mapContact(contact: Contact): KimiContact {
  const custom = contact.customFields as { linkedin?: string; timezone?: string } | undefined;
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    email: contact.email || null,
    company: contact.company ?? null,
    status:
      contact.status === "Subscribed"
        ? "Active"
        : contact.status === "Unsubscribed"
          ? "Unsubscribed"
          : contact.status === "Blocked"
            ? "Blocked"
            : "Invalid",
    tags: contact.tags,
    timezone: custom?.timezone ?? null,
    linkedin: custom?.linkedin ?? null,
    consentDate: contact.consentDate,
    consentSource: contact.consentSource,
    dateAdded: contact.dateAdded,
    lastReply: contact.lastReply,
    lastMessaged: contact.lastMessaged,
  };
}

export function ContactDetailConnected({ contact }: { contact: Contact }) {
  const kimiContact = mapContact(contact);
  const custom = contact.customFields as { linkedin?: string; timezone?: string } | undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <Link
        href="/contacts"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to contacts
      </Link>

      <ContactHeader contact={kimiContact} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <ContactAppointmentsPanel contactId={contact.id} />
          <ContactVisualizerProjectsPanel contactId={contact.id} />
          <ContactActivityTimeline contactId={contact.id} />
          <ConnectedRecordsPanel contactId={contact.id} />
        </div>
        <div className="space-y-6">
          <ContactProfileCard contact={kimiContact} />
          <ContactProfileEdit
            contactId={contact.id}
            timezone={custom?.timezone ?? null}
            linkedin={custom?.linkedin}
          />
        </div>
      </div>
    </div>
  );
}
