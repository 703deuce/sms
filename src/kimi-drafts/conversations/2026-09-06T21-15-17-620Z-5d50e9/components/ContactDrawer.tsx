"use client";

import React from "react";
import { CalendarClock, CheckCircle2, Mail, Phone, Tag as TagIcon, X } from "lucide-react";
import type { Conversation } from "../mock-data";

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="tv-detail-row">
      <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--tv-bg)", border: "1px solid var(--tv-border-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} style={{ color: "var(--tv-muted)" }} />
      </span>
      <div>
        <div className="tv-detail-label">{label}</div>
        <div className="tv-detail-value">{value}</div>
      </div>
    </div>
  );
}

export function ContactDrawer({ convo, onClose }: { convo: Conversation; onClose: () => void }) {
  return (
    <>
      <button type="button" className="tv-scrim" aria-label="Close contact details" onClick={onClose} />
      <aside className="tv-drawer" role="dialog" aria-label="Contact details">
        <div className="tv-drawer-head">
          Contact Details
          <button type="button" className="tv-iconbtn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="tv-drawer-body">
          <div style={{ textAlign: "center" }}>
            <span className="tv-avatar" style={{ width: 64, height: 64, fontSize: 18, margin: "0 auto", boxShadow: "0 0 0 4px var(--tv-primary-softer)" }}>{convo.initials}</span>
            <p style={{ fontSize: 16, fontWeight: 700, marginTop: 11 }}>{convo.name}</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--tv-green-soft)", color: "var(--tv-green)" }}>
              <CheckCircle2 size={12} /> Subscribed
            </span>
            <p style={{ fontSize: 12, color: "var(--tv-muted)", marginTop: 6 }}>Added Aug 27th, 2024</p>
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--tv-border-soft)" }}>
            <Row icon={Phone} label="Mobile Number" value={convo.phone} />
            <Row icon={Mail} label="Email" value="patrick@example.com" />
            {convo.appointment ? <Row icon={CalendarClock} label="Upcoming appointment" value={convo.appointment} /> : null}
          </div>

          <dl style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--tv-border-soft)" }}>
            <div style={{ marginBottom: 14 }}>
              <dt className="tv-detail-label">Lists</dt>
              <dd style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tv-tagpill">Customers</span>
                <span className="tv-tagpill">Repeat clients</span>
              </dd>
            </div>
            <div style={{ marginBottom: 14 }}>
              <dt className="tv-detail-label">Opt-out</dt>
              <dd className="tv-detail-value" style={{ marginTop: 4 }}>No</dd>
            </div>
            <div>
              <dt className="tv-detail-label">Last message</dt>
              <dd className="tv-detail-value" style={{ marginTop: 4 }}>{convo.time}</dd>
            </div>
          </dl>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--tv-border-soft)" }}>
            <p className="tv-detail-label" style={{ marginBottom: 8 }}>Tags</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {convo.tags.map((t) => (
                <span key={t} className="tv-tagpill" style={{ color: "var(--tv-primary)", background: "var(--tv-primary-softer)", borderColor: "#dfe4ff" }}>{t}</span>
              ))}
              <button type="button" className="tv-tagpill" style={{ borderStyle: "dashed", cursor: "pointer", background: "none" }}>
                <TagIcon size={10} /> Add tag
              </button>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <button type="button" className="tv-btn" style={{ width: "100%", justifyContent: "center" }}>View full contact record</button>
          </div>
        </div>
      </aside>
    </>
  );
}
