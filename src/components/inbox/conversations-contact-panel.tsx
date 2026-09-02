"use client";

import Link from "next/link";
import { Pencil, X } from "lucide-react";
import type { Conversation } from "@/components/kimi/conversations/mock-data";
import { formatPhone } from "@/lib/utils";

type Props = {
  convo: Conversation;
  onClose: () => void;
};

export function ConversationsContactPanel({ convo, onClose }: Props) {
  const [firstName, ...rest] = convo.name.split(" ").filter(Boolean);
  const lastName = rest.join(" ");

  const fields: Array<{ label: string; value: string; href?: string }> = [
    { label: "First Name", value: firstName || "—" },
    { label: "Last Name", value: lastName || "—" },
    { label: "Mobile Number", value: convo.phone ? formatPhone(convo.phone) : "—" },
    { label: "Email", value: convo.email || "—" },
  ];

  return (
    <div
      className="ref-scroll"
      style={{
        width: 276,
        borderLeft: "1px solid var(--tv-border)",
        background: "#fff",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "22px 16px 16px",
          borderBottom: "1px solid var(--tv-border)",
          position: "relative",
          background: "linear-gradient(180deg, var(--tv-panel) 0%, #fff 100%)",
        }}
      >
        <button
          type="button"
          className="tv-icon-btn"
          onClick={onClose}
          title="Close panel"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            border: "none",
            background: "transparent",
            borderRadius: 7,
          }}
        >
          <X size={14} />
        </button>
        <span
          className="tv-avatar"
          style={{
            width: 52,
            height: 52,
            fontSize: 17,
            background: convo.color,
            boxShadow: "0 2px 8px rgba(16,24,40,.14), inset 0 0 0 1px rgba(255,255,255,.2)",
          }}
        >
          {convo.initials}
        </span>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            marginTop: 11,
            letterSpacing: -0.2,
            color: "var(--tv-text)",
          }}
        >
          {convo.name}
        </div>
        {convo.contactId ? (
          <Link
            href={`/contacts/${convo.contactId}`}
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--tv-primary)",
              textDecoration: "none",
            }}
          >
            View full contact profile →
          </Link>
        ) : null}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--tv-faint)",
            letterSpacing: 0.8,
            margin: "2px 0 14px",
          }}
        >
          CONTACT DETAILS
        </div>
        {fields.map((field) => (
          <div
            key={field.label}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: "var(--tv-faint)", marginBottom: 2.5 }}>
                {field.label}
              </div>
              <div className={"tv-field-value" + (field.value === "—" ? " empty" : "")}>
                {field.value}
              </div>
            </div>
            {convo.contactId ? (
              <Link href={`/contacts/${convo.contactId}`} title={`Edit ${field.label.toLowerCase()}`}>
                <Pencil size={12} color="#d1d5db" style={{ cursor: "pointer", flexShrink: 0 }} />
              </Link>
            ) : (
              <Pencil size={12} color="#d1d5db" style={{ flexShrink: 0, opacity: 0.35 }} />
            )}
          </div>
        ))}
        <Link
          href="/conversations/saved-replies"
          style={{
            display: "block",
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--tv-primary)",
          }}
        >
          Saved replies →
        </Link>
        <button
          type="button"
          className="tv-btn-ghost"
          onClick={onClose}
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: 12,
            borderRadius: 8,
            border: "1px solid var(--tv-border)",
          }}
        >
          Close Panel
        </button>
      </div>
    </div>
  );
}
