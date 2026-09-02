"use client";
import React from "react";
import { ArrowDownUp, Inbox as InboxIcon } from "lucide-react";
import { Conversation } from "../mock-data";

export default function ConversationList({
  title,
  subtitle,
  convos,
  selectedId,
  onSelect,
  checked,
  onCheck,
  allChecked,
  onCheckAll,
  sortOrder = "newest",
  onToggleSort,
  className = "",
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  title: string;
  subtitle: string;
  convos: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  checked: Set<string>;
  onCheck: (id: string, v: boolean) => void;
  allChecked: boolean;
  onCheckAll: (v: boolean) => void;
  sortOrder?: "newest" | "oldest";
  onToggleSort?: () => void;
  className?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <div
      className={className}
      style={{
        width: 304,
        borderRight: "1px solid var(--tv-border)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--tv-border)",
          minHeight: 57,
        }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => onCheckAll(e.target.checked)}
          style={{
            accentColor: "var(--tv-primary)",
            width: 15,
            height: 15,
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: "var(--tv-text)" }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: "var(--tv-faint)", marginTop: 1.5 }}>{subtitle}</div>
        </div>
        {onToggleSort ? (
          <button
            type="button"
            className="tv-icon-btn"
            title={sortOrder === "newest" ? "Newest first" : "Oldest first"}
            onClick={onToggleSort}
            style={{ width: 28, height: 28, flexShrink: 0 }}
          >
            <ArrowDownUp size={14} />
          </button>
        ) : null}
      </div>
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {convos.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "56px 24px", textAlign: "center" }}>
            <span style={{
              width: 44, height: 44, borderRadius: 9999, background: "var(--tv-primary-soft)",
              boxShadow: "0 0 0 8px color-mix(in srgb, var(--tv-primary) 4%, transparent)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <InboxIcon size={19} color="var(--tv-primary)" strokeWidth={1.7} />
            </span>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tv-text-2)", marginTop: 4 }}>No conversations here</div>
            <div style={{ fontSize: 12, color: "var(--tv-faint)", lineHeight: 1.55, maxWidth: 220 }}>Conversations matching this filter will appear here.</div>
          </div>
        )}
        {convos.map((c) => {
          const isChecked = checked.has(c.id);
          const active = selectedId === c.id;
          return (
            <div key={c.id} onClick={() => onSelect(c)}
              className={"tv-convo-row" + (isChecked ? " checked" : active ? " active" : "")}>
              <input type="checkbox" checked={isChecked} onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCheck(c.id, e.target.checked)}
                style={{ accentColor: "var(--tv-primary)", width: 15, height: 15, marginTop: 11, cursor: "pointer", flexShrink: 0 }} />
              <span className="tv-avatar" style={{ width: 34, height: 34, fontSize: 12, background: c.color, marginTop: 1, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" }}>{c.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 600, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--tv-text)" }}>{c.name}</span>
                  <span style={{ fontSize: 10.5, color: c.unread ? "var(--tv-primary)" : "var(--tv-faint)", fontWeight: c.unread ? 600 : 400, whiteSpace: "nowrap", flexShrink: 0 }}>{c.ago}</span>
                </div>
                <div style={{
                  fontSize: 12.5, marginTop: 2.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.45,
                  color: c.unread ? "var(--tv-text)" : "var(--tv-muted)", fontWeight: c.unread ? 600 : 400,
                }}>{c.preview}</div>
              </div>
              {c.unread && <span className="tv-unread-dot" />}
            </div>
          );
        })}
        {hasMore ? (
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--tv-border-soft)" }}>
            <button
              type="button"
              className="tv-btn-ghost"
              disabled={loadingMore}
              onClick={onLoadMore}
              style={{ width: "100%", justifyContent: "center", borderRadius: 8 }}
            >
              {loadingMore ? "Loading…" : "Load more conversations"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
