"use client";

import type { Contact } from "../types";
import { StatusChip, formatPhone } from "./ui";
import { ContactBookingActions } from "./ContactBookingActions";
import { ClickToCallButton } from "./ClickToCallButton";
import { Building2, Mail, Phone, Tag } from "lucide-react";

function initialsOf(c: Contact) {
  const f = c.firstName?.trim()?.[0] || "";
  const l = c.lastName?.trim()?.[0] || "";
  return (f + l).toUpperCase() || c.phone.slice(-2);
}

export function ContactHeader({ contact }: { contact: Contact }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <span
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(67,56,202,0.1)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initialsOf(contact)}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {contact.firstName} {contact.lastName}
            </h1>
            <StatusChip status={contact.status} />
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 18px",
              fontSize: 13,
              color: "var(--muted-foreground)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Phone style={{ width: 13, height: 13 }} />
              {formatPhone(contact.phone)}
            </span>
            {contact.email ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Mail style={{ width: 13, height: 13 }} />
                {contact.email}
              </span>
            ) : null}
            {contact.company ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Building2 style={{ width: 13, height: 13 }} />
                {contact.company}
              </span>
            ) : null}
          </div>

          {contact.tags.length ? (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Tag style={{ width: 12, height: 12, color: "var(--muted-foreground)" }} />
              {contact.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "var(--muted)",
                    color: "var(--secondary-foreground)",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <ClickToCallButton phone={contact.phone} />
          <ContactBookingActions
            contactId={contact.id}
            phone={contact.phone}
            email={contact.email}
          />
        </div>
      </div>
    </div>
  );
}
