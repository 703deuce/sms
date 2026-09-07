"use client";

import type { Contact } from "../types";
import { Card, SectionHeader, formatDate, formatPhone } from "./ui";
import { Shield, User } from "lucide-react";

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const empty = value === "—" || value == null || value === "";
  return (
    <div style={{ minWidth: 0 }}>
      <dt
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: "3px 0 0",
          fontSize: 13,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
          color: empty ? "rgba(93,100,114,0.7)" : "var(--foreground)",
          fontWeight: empty ? 400 : 500,
        }}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

export function ContactProfileCard({ contact }: { contact: Contact }) {
  const consentEvents: { id: string; event: string; source: string | null; at: string | null; detail: string }[] = [];
  if (contact.consentDate) {
    consentEvents.push({
      id: "ch_1",
      event: "Opt-in recorded",
      source: contact.consentSource,
      at: contact.consentDate,
      detail: "Initial consent captured",
    });
  }
  if (contact.status === "Unsubscribed") {
    consentEvents.push({
      id: "ch_2",
      event: "Unsubscribed",
      source: "STOP keyword",
      at: contact.lastReply ?? contact.lastMessaged ?? contact.consentDate,
      detail: "Contact opted out",
    });
  }

  return (
    <>
      <Card style={{ padding: 18 }}>
        <SectionHeader icon={<User />} title="Profile" description="Contact details and identifiers." />
        <dl
          style={{
            margin: "14px 0 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px 16px",
          }}
        >
          <Field label="First name" value={contact.firstName} />
          <Field label="Last name" value={contact.lastName} />
          <Field label="Phone" value={formatPhone(contact.phone)} mono />
          <Field label="Email" value={contact.email} />
          <Field label="Company" value={contact.company} />
          <Field label="Timezone" value={contact.timezone} />
          <Field label="Added" value={formatDate(contact.dateAdded)} />
          <Field label="Last reply" value={formatDate(contact.lastReply)} />
        </dl>
      </Card>

      <Card style={{ padding: 18, marginTop: 24 }}>
        <SectionHeader
          icon={<Shield />}
          title="Consent"
          description="SMS consent state and history for this contact."
        />
        {consentEvents.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted-foreground)" }}>
            No consent events recorded yet.
          </p>
        ) : (
          <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none" }}>
            {consentEvents.map((e, i) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  gap: 10,
                  paddingBottom: i === consentEvents.length - 1 ? 0 : 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    marginTop: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#10b981",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{e.event}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                    {e.source ? `${e.source} · ` : ""}
                    {formatDate(e.at)} — {e.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
