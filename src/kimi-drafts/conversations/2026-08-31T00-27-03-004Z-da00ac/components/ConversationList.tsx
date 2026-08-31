"use client";
import React from "react";
import { Conversation } from "../mock-data";

export default function ConversationList({ title, subtitle, convos, selectedId, onSelect, checked, onCheck, allChecked, onCheckAll }:{
  title: string; subtitle: string; convos: Conversation[]; selectedId: string | null;
  onSelect: (c: Conversation)=>void; checked: Set<string>; onCheck: (id: string, v: boolean)=>void;
  allChecked: boolean; onCheckAll: (v: boolean)=>void;
}) {
  return (
    <div style={{ width: 300, borderRight: "1px solid var(--tv-border)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--tv-border)" }}>
        <input type="checkbox" checked={allChecked} onChange={(e) => onCheckAll(e.target.checked)} style={{ accentColor: "var(--tv-primary)", width: 15, height: 15, cursor: "pointer" }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{subtitle}</div>
        </div>
      </div>
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {convos.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No conversations here.</div>}
        {convos.map((c) => {
          const isChecked = checked.has(c.id);
          const active = selectedId === c.id;
          return (
            <div key={c.id} onClick={() => onSelect(c)} style={{
              display: "flex", gap: 10, padding: "12px 14px", cursor: "pointer",
              borderBottom: "1px solid #f3f4f6",
              background: isChecked ? "#e0e7ff" : active ? "#eef2ff" : "#fff",
              borderLeft: active ? "3px solid var(--tv-primary)" : "3px solid transparent",
            }}>
              <input type="checkbox" checked={isChecked} onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCheck(c.id, e.target.checked)}
                style={{ accentColor: "var(--tv-primary)", width: 15, height: 15, marginTop: 12, cursor: "pointer", flexShrink: 0 }} />
              <span className="tv-avatar" style={{ width: 34, height: 34, fontSize: 12, background: c.color }}>{c.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                  <span style={{ fontSize: 10.5, color: "#9ca3af", whiteSpace: "nowrap" }}>{c.ago}</span>
                </div>
                <div style={{
                  fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  color: c.unread ? "#111827" : "#6b7280", fontWeight: c.unread ? 600 : 400,
                }}>{c.preview}</div>
              </div>
              {c.unread && <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--tv-primary)", marginTop: 6, flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
