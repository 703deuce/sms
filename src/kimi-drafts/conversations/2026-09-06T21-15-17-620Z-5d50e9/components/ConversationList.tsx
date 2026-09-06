"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { Conversation } from "../mock-data";
import type { RailFilter } from "./InboxRail";

const CHIPS = ["All", "Unread", "Needs reply", "AI booking", "Appointments", "Unknown replies"] as const;

export function ConversationList({
  conversations, filter, selectedId, selected, onSelect, onToggleSelect, onToggleSelectAll, loading, searchQuery = "",
}: {
  conversations: Conversation[]; filter: RailFilter; selectedId: string | null;
  selected: Set<string>; onSelect: (c: Conversation) => void;
  onToggleSelect: (id: string) => void; onToggleSelectAll: () => void;
  loading?: boolean; searchQuery?: string;
}) {
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("All");
  const [sortDesc, setSortDesc] = useState(true);
  const [shown, setShown] = useState(20);

  const list = useMemo(() => {
    let l = [...conversations];
    if (filter.kind === "mine") {
      l = l.filter((c) => c.assignee === "Me");
      if (filter.status === "Unread") l = l.filter((c) => c.unread);
      else if (filter.status && filter.status !== "All") l = l.filter((c) => c.status === filter.status);
    } else if (filter.kind === "all") {
      if (filter.status === "Unassigned") l = l.filter((c) => !c.assignee);
      else if (filter.status === "Unread") l = l.filter((c) => c.unread);
      else if (filter.status && filter.status !== "All") l = l.filter((c) => c.status === filter.status);
    } else if (filter.kind === "tag") l = l.filter((c) => c.tags.includes(filter.tag));
    else if (filter.kind === "teammate") l = l.filter((c) => c.assignee === filter.teammate);
    if (chip === "Unread") l = l.filter((c) => c.unread);
    else if (chip === "Needs reply") l = l.filter((c) => c.messages[c.messages.length - 1]?.kind === "inbound");
    else if (chip === "AI booking") l = l.filter((c) => c.aiActive);
    else if (chip === "Appointments") l = l.filter((c) => c.appointment);
    else if (chip === "Unknown replies") l = l.filter((c) => c.unknownReply);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      l = l.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        c.preview.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (!sortDesc) l.reverse();
    return l;
  }, [conversations, filter, chip, sortDesc, searchQuery]);

  const visible = list.slice(0, shown);

  const title =
    filter.kind === "mine" ? "Me" : filter.kind === "all" ? "Everyone" :
    filter.kind === "tag" ? filter.tag : filter.teammate;
  const subtitle =
    filter.kind === "mine" || filter.kind === "all"
      ? `${filter.status ?? "All"} Conversations`
      : "All Conversations";

  return (
    <section className="tv-list" aria-label="Conversation list">
      <div className="tv-list-head">
        <input type="checkbox" aria-label="Select all conversations"
          checked={list.length > 0 && list.every((c) => selected.has(c.id))}
          onChange={onToggleSelectAll}
          style={{ accentColor: "var(--tv-primary)", width: 15, height: 15 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tv-list-title">{title}</div>
          <div className="tv-list-sub">{subtitle}{searchQuery.trim() ? ` · matching “${searchQuery.trim()}”` : ""}</div>
        </div>
        <button type="button" className="tv-iconbtn" onClick={() => setSortDesc((v) => !v)} title="Toggle sort" aria-label="Toggle sort order">
          <ArrowUpDown size={14} />
        </button>
      </div>

      <div className="tv-filters" role="group" aria-label="Conversation filters">
        {CHIPS.map((c) => (
          <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)} className={"tv-chip" + (chip === c ? " active" : "")}>{c}</button>
        ))}
        {chip !== "All" ? (
          <button type="button" className="tv-chip tv-chip-clear" onClick={() => setChip("All")}>Clear filters</button>
        ) : null}
      </div>

      <div className="tv-convos" role="list">
        {loading ? (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="tv-skel" style={{ height: 62 }} />)}
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tv-text)" }}>
              {searchQuery.trim() ? `No conversations match “${searchQuery.trim()}”` : "No conversations match"}
            </p>
            <p style={{ fontSize: 12, color: "var(--tv-muted)", marginTop: 4 }}>Try a different filter or clear your selection.</p>
            <button type="button" className="tv-btn sm" style={{ marginTop: 12 }} onClick={() => setChip("All")}>Clear filters</button>
          </div>
        ) : (
          <>
            {visible.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const needsReply = last?.kind === "inbound";
              return (
                <button key={c.id} type="button" role="listitem" onClick={() => onSelect(c)}
                  className={"tv-convo" + (selectedId === c.id ? " active" : "") + (c.unread ? " unread" : "")}
                  aria-current={selectedId === c.id}>
                  <input type="checkbox" aria-label={`Select conversation with ${c.name}`}
                    checked={selected.has(c.id)} onChange={() => onToggleSelect(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: "var(--tv-primary)", marginTop: 10, width: 14, height: 14, flexShrink: 0 }} />
                  <span className="tv-avatar" aria-hidden>{c.initials}</span>
                  <span className="tv-convo-body">
                    <span className="tv-convo-row">
                      <span className="tv-convo-name">{c.name}</span>
                      <span className="tv-convo-time">{c.time}</span>
                    </span>
                    <span className="tv-convo-preview">{c.preview}</span>
                    <span className="tv-convo-meta">
                      {c.tags.map((t) => <span key={t} className="tv-tagpill">{t}</span>)}
                      {needsReply ? <span className="tv-tagpill" style={{ color: "var(--tv-amber)", borderColor: "#fde68a", background: "var(--tv-amber-soft)" }}>Needs reply</span> : null}
                      {c.aiActive ? <span className="tv-tagpill" style={{ color: "var(--tv-primary)", borderColor: "#dfe4ff", background: "var(--tv-primary-softer)" }}>AI booking</span> : null}
                      {c.unknownReply ? <span className="tv-tagpill" style={{ color: "var(--tv-red)", borderColor: "#fecaca", background: "var(--tv-red-soft)" }}>Unknown reply</span> : null}
                    </span>
                  </span>
                  {c.unread ? <span className="tv-unread-dot" aria-label="Unread" /> : null}
                </button>
              );
            })}
            {list.length > shown ? (
              <div style={{ padding: 12, textAlign: "center" }}>
                <button type="button" className="tv-btn sm" onClick={() => setShown((s) => s + 20)}>
                  Load more ({list.length - shown} remaining)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
