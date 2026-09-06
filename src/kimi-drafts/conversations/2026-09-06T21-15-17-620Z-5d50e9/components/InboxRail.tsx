"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Inbox, MailOpen, MessageSquare, Clock, CheckCircle2, UserX, Tag as TagIcon, Users, Search, MessageSquarePlus, Settings, X } from "lucide-react";
import type { Conversation, Tag, Teammate } from "../mock-data";

export type RailFilter =
  | { kind: "mine"; status?: "All" | "Unread" | "Open" | "Pending" | "Closed" }
  | { kind: "all"; status?: "All" | "Unassigned" | "Unread" | "Open" | "Pending" | "Closed" }
  | { kind: "tag"; tag: string }
  | { kind: "teammate"; teammate: string };

function Group({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="tv-rail-group" aria-expanded={open}>
        {label}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open ? children : null}
    </div>
  );
}

function Item({ active, icon, label, count, onClick }: { active?: boolean; icon?: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick()} className={"tv-rail-item" + (active ? " active" : "")}>
      {icon ? <span className="tv-ic">{icon}</span> : null}
      {label}
      {count !== undefined ? <span className="tv-rail-count">{count}</span> : null}
    </div>
  );
}

export function InboxRail({
  conversations, tags, teammates, filter, onFilter, onNew, onOpenSettings, searchQuery, onSearchChange,
}: {
  conversations: Conversation[]; tags: Tag[]; teammates: Teammate[];
  filter: RailFilter; onFilter: (f: RailFilter) => void; onNew: () => void; onOpenSettings: () => void;
  searchQuery: string; onSearchChange: (q: string) => void;
}) {
  const mine = conversations.filter((c) => c.assignee === "Me");
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presence, setPresence] = useState<"Online" | "Away" | "Do not disturb">("Online");
  const count = (list: Conversation[], fn: (c: Conversation) => boolean) => list.filter(fn).length;
  const is = (f: RailFilter) => JSON.stringify(f) === JSON.stringify(filter);

  const presenceColor = presence === "Online" ? "var(--tv-green)" : presence === "Away" ? "#f59e0b" : "#9ca3af";

  return (
    <nav className="tv-rail" aria-label="Inbox navigation">
      <div className="tv-rail-head">
        <span className="tv-rail-title">Inbox</span>
        <div style={{ position: "relative" }}>
          <button type="button" className="tv-presence" onClick={() => setPresenceOpen((v) => !v)} aria-expanded={presenceOpen}
            style={{ color: presenceColor, background: presence === "Online" ? "var(--tv-green-soft)" : "var(--tv-bg)", borderColor: presence === "Online" ? "#a7f3d0" : "var(--tv-border)" }}>
            <span className="tv-presence-dot" style={{ background: presenceColor }} /> {presence} <ChevronDown size={11} />
          </button>
          {presenceOpen ? (
            <div className="tv-pop" style={{ top: "calc(100% + 6px)", right: 0, minWidth: 160 }}>
              {(["Online", "Away", "Do not disturb"] as const).map((p) => (
                <button key={p} type="button" className="tv-pop-item" onClick={() => { setPresence(p); setPresenceOpen(false); }}>
                  <span className="tv-presence-dot" style={{ background: p === "Online" ? "var(--tv-green)" : p === "Away" ? "#f59e0b" : "#9ca3af" }} />
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="tv-rail-search">
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 8, color: "var(--tv-muted)" }} />
          <input
            className="tv-textinput" placeholder="Search" aria-label="Search conversations"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: 28, paddingRight: searchQuery ? 26 : 10, height: 30, fontSize: 12.5 }}
          />
          {searchQuery ? (
            <button type="button" aria-label="Clear search" onClick={() => onSearchChange("")}
              style={{ position: "absolute", right: 4, top: 4, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--tv-muted)", borderRadius: 6 }}>
              <X size={12} />
            </button>
          ) : null}
        </div>
        <button type="button" className="tv-iconbtn" onClick={onNew} title="New Message" aria-label="New Message"
          style={{ border: "1px solid var(--tv-border)", background: "var(--tv-primary)", color: "#fff" }}>
          <MessageSquarePlus size={15} />
        </button>
      </div>

      <Group label="My Conversations">
        <Item active={is({ kind: "mine", status: "All" })} icon={<Inbox size={13} />} label="All" count={mine.length} onClick={() => onFilter({ kind: "mine", status: "All" })} />
        <Item active={is({ kind: "mine", status: "Unread" })} icon={<MailOpen size={13} />} label="Unread" count={count(mine, (c) => c.unread)} onClick={() => onFilter({ kind: "mine", status: "Unread" })} />
        <Item active={is({ kind: "mine", status: "Open" })} icon={<MessageSquare size={13} />} label="Open" count={count(mine, (c) => c.status === "Open")} onClick={() => onFilter({ kind: "mine", status: "Open" })} />
        <Item active={is({ kind: "mine", status: "Pending" })} icon={<Clock size={13} />} label="Pending" count={count(mine, (c) => c.status === "Pending")} onClick={() => onFilter({ kind: "mine", status: "Pending" })} />
      </Group>

      <Group label="All Conversations">
        <Item active={is({ kind: "all", status: "All" })} icon={<Inbox size={13} />} label="All" count={conversations.length} onClick={() => onFilter({ kind: "all", status: "All" })} />
        <Item active={is({ kind: "all", status: "Unassigned" })} icon={<UserX size={13} />} label="Unassigned" count={count(conversations, (c) => !c.assignee)} onClick={() => onFilter({ kind: "all", status: "Unassigned" })} />
        <Item active={is({ kind: "all", status: "Unread" })} icon={<MailOpen size={13} />} label="Unread" count={count(conversations, (c) => c.unread)} onClick={() => onFilter({ kind: "all", status: "Unread" })} />
        <Item active={is({ kind: "all", status: "Open" })} icon={<MessageSquare size={13} />} label="Open" count={count(conversations, (c) => c.status === "Open")} onClick={() => onFilter({ kind: "all", status: "Open" })} />
        <Item active={is({ kind: "all", status: "Pending" })} icon={<Clock size={13} />} label="Pending" count={count(conversations, (c) => c.status === "Pending")} onClick={() => onFilter({ kind: "all", status: "Pending" })} />
        <Item active={is({ kind: "all", status: "Closed" })} icon={<CheckCircle2 size={13} />} label="Closed" count={count(conversations, (c) => c.status === "Closed")} onClick={() => onFilter({ kind: "all", status: "Closed" })} />
      </Group>

      <Group label="Tagged Conversations" defaultOpen={false}>
        {tags.map((t) => (
          <Item key={t.id} active={is({ kind: "tag", tag: t.name })} icon={<TagIcon size={12} color={t.color} />} label={t.name}
            count={count(conversations, (c) => c.tags.includes(t.name))} onClick={() => onFilter({ kind: "tag", tag: t.name })} />
        ))}
      </Group>

      <Group label="Teammate's Conversations" defaultOpen={false}>
        {teammates.filter((t) => t.id !== "me").map((t) => (
          <Item key={t.id} active={is({ kind: "teammate", teammate: t.name })} icon={<Users size={13} />} label={t.name}
            count={count(conversations, (c) => c.assignee === t.name)} onClick={() => onFilter({ kind: "teammate", teammate: t.name })} />
        ))}
      </Group>

      <div style={{ marginTop: "auto", padding: 12, borderTop: "1px solid var(--tv-border-soft)" }}>
        <button type="button" className="tv-pop-item" onClick={onOpenSettings} style={{ width: "100%" }}>
          <Settings size={14} style={{ color: "var(--tv-muted)" }} /> Inbox settings
        </button>
      </div>
    </nav>
  );
}
