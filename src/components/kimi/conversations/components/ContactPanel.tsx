"use client";
import React, { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import type { Contact } from "@/lib/types";
import { Conversation } from "../mock-data";
import { fetchContact } from "../conversation-flow-utils";

export default function ContactPanel({ convo, onClose }:{ convo: Conversation; onClose: ()=>void }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!convo.contactId) {
      setContact(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchContact(convo.contactId)
      .then((data) => {
        if (!cancelled) setContact(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [convo.contactId]);

  const firstName = contact?.firstName || convo.name.split(" ")[0] || "";
  const lastName = contact?.lastName || convo.name.split(" ").slice(1).join(" ") || "";
  const phone = contact?.phone || convo.phone;
  const email = contact?.email || convo.email || "";
  const status = contact?.status || "Subscribed";
  const dateAdded = contact?.dateAdded
    ? new Date(contact.dateAdded).toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const fields: [string, string][] = [
    ["First Name", firstName],
    ["Last Name", lastName],
    ["Mobile Number", phone],
    ["Email", email],
    ["Company", contact?.company ?? ""],
    ["Assigned User", contact?.assignedUser ?? ""],
    ["Consent Source", contact?.consentSource ?? ""],
    ["Last Messaged", contact?.lastMessaged ? new Date(contact.lastMessaged).toLocaleString() : ""],
    ["Last Reply", contact?.lastReply ? new Date(contact.lastReply).toLocaleString() : ""],
  ];

  return (
    <div className="ref-scroll" style={{ width: 272, borderLeft: "1px solid var(--tv-border)", background: "#fff", overflowY: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 14px", borderBottom: "1px solid var(--tv-border)", position: "relative" }}>
        <button className="tv-icon-btn" onClick={onClose} title="Close panel" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, border: "none", background: "transparent" }}>
          <X size={14} />
        </button>
        <span className="tv-avatar" style={{ width: 48, height: 48, fontSize: 16, background: convo.color, boxShadow: "0 2px 6px rgba(16,24,40,.12)" }}>{convo.initials}</span>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, letterSpacing: -0.1 }}>{convo.name}</div>
        {dateAdded ? (
          <div style={{ fontSize: 11, color: "var(--tv-faint)", marginTop: 2 }}>{dateAdded}</div>
        ) : null}
        <button className="tv-chip" style={{ marginTop: 10, cursor: "default", color: status === "Subscribed" ? "#059669" : "#dc2626", borderColor: status === "Subscribed" ? "#a7f3d0" : "#fecaca", background: status === "Subscribed" ? "#ecfdf5" : "#fef2f2", fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: status === "Subscribed" ? "#10b981" : "#ef4444" }} />
          {status}
        </button>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--tv-faint)", letterSpacing: 0.7, margin: "4px 0 12px" }}>CONTACT DETAILS</div>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--tv-faint)" }}>Loading contact…</p>
        ) : null}
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: "var(--tv-faint)", marginBottom: 2 }}>{k}</div>
              <div className={"tv-field-value" + (v ? "" : " empty")}>{v || "—"}</div>
            </div>
            <Pencil size={12} color="#d1d5db" style={{ flexShrink: 0, opacity: 0.4 }} />
          </div>
        ))}
        {contact?.tags?.length ? (
          <div style={{ marginBottom: 13 }}>
            <div style={{ fontSize: 10.5, color: "var(--tv-faint)", marginBottom: 6 }}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {contact.tags.map((tag) => (
                <span key={tag} className="tv-chip">{tag}</span>
              ))}
            </div>
          </div>
        ) : null}
        <button className="tv-btn-ghost" onClick={onClose} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>Close Panel</button>
      </div>
    </div>
  );
}
