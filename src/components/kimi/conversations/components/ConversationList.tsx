"use client";
import React from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { Conversation } from "../mock-data";

export default function ConversationList({ title, subtitle, convos, selectedId, onSelect, checked, onCheck, allChecked, onCheckAll, loading = false }:{
  title: string; subtitle: string; convos: Conversation[]; selectedId: string | null;
  onSelect: (c: Conversation)=>void; checked: Set<string>; onCheck: (id: string, v: boolean)=>void;
  allChecked: boolean; onCheckAll: (v: boolean)=>void; loading?: boolean;
}) {
  return (
    <div style={{ width: 300, borderRight: "1px solid var(--tv-border)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--tv-border)", minHeight: 57 }}>
        <input type="checkbox" checked={allChecked} onChange={(e) => onCheckAll(e.target.checked)} style={{ accentColor: "var(--tv-primary)", width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.1 }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--tv-faint)", marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--tv-faint)" }}>Loading conversations…</div>
          </div>
        ) : convos.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 24px", textAlign: "center" }}>
            <span style={{ width: 40, height: 40, borderRadius: 9999, background: "var(--tv-primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <InboxIcon size={18} color="var(--tv-primary)" />
            </span>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tv-text-2)" }}>No conversations here</div>
            <div style={{ fontSize: 12, color: "var(--tv-faint)" }}>Conversations matching this filter will appear here.</div>
          </div>
        ) : null}
        {!loading && convos.map((c) => {
          const isChecked = checked.has(c.id);
          const active = selectedId === c.id;
          return (
            <div key={c.id} onClick={() => onSelect(c)}
              className={"tv-convo-row" + (isChecked ? " checked" : active ? " active" : "")}>
              <input type="checkbox" checked={isChecked} onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCheck(c.id, e.target.checked)}
                style={{ accentColor: "var(--tv-primary)", width: 15, height: 15, marginTop: 11, cursor: "pointer", flexShrink: 0 }} />
              <span className="tv-avatar" style={{ width: 34, height: 34, fontSize: 12, background: c.color, marginTop: 1 }}>{c.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--tv-text)" }}>{c.name}</span>
                  <span style={{ fontSize: 10.5, color: "var(--tv-faint)", whiteSpace: "nowrap", flexShrink: 0 }}>{c.ago}</span>
                </div>
                <div style={{
                  fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  color: c.unread ? "var(--tv-text)" : "var(--tv-muted)", fontWeight: c.unread ? 600 : 400,
                }}>{c.preview}</div>
              </div>
              {c.unread && <span className="tv-unread-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
