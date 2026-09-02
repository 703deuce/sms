"use client";
import React, { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, ChevronRight, MessageSquarePlus, Inbox as InboxIcon, MailQuestion, MessageSquare, Clock, CheckCircle2, Tag as TagIcon, CircleSlash, Settings, Ban, AlarmClock } from "lucide-react";
import type { Tag, Teammate } from "@/lib/inbox/conversation-types";
import { presenceColor, presenceLabel, presencePillStyles } from "@/lib/inbox/team-presence";

export type FilterSel = { kind: "mine" | "all" | "tag" | "teammate"; key: string; sub?: string };

const Item = ({ active, icon, label, count, onClick, indent, chevron, expanded }:{
  active?: boolean; icon?: React.ReactNode; label: string; count?: number; onClick?: ()=>void; indent?: boolean;
  chevron?: boolean; expanded?: boolean;
}) => (
  <div onClick={onClick} className={"tv-rail-item" + (active ? " active" : "")}
    style={indent ? { paddingLeft: 28 } : undefined}>
    {chevron !== undefined && (
      <span style={{ display: "flex", color: "var(--tv-faint)", marginLeft: -4 }}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
    )}
    {icon && <span style={{ display: "flex", color: active ? "var(--tv-primary)" : "var(--tv-faint)" }}>{icon}</span>}
    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    {count !== undefined && <span className="tv-count">{count}</span>}
  </div>
);

const Group = ({ title, children, defaultOpen = true }:{ title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 14 }}>
      <div onClick={() => setOpen(!open)} className="tv-rail-group">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{title}
      </div>
      {open && <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 1 }}>{children}</div>}
    </div>
  );
};

const SUBS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <InboxIcon size={13} /> },
  { key: "open", label: "Open", icon: <MessageSquare size={13} /> },
  { key: "pending", label: "Pending", icon: <Clock size={13} /> },
  { key: "closed", label: "Closed", icon: <CheckCircle2 size={13} /> },
];

export default function InboxRail({ sel, onSel, counts, onNew, tags, teammates, searchQuery, onSearchChange, onOpenSettings, myPresenceStatus = "available", onPresenceChange, presenceByUserId = {} }:{
  sel: FilterSel; onSel: (s: FilterSel)=>void; counts: Record<string, number>; onNew: ()=>void;
  tags?: Tag[]; teammates?: Teammate[];
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onOpenSettings?: () => void;
  myPresenceStatus?: string;
  onPresenceChange?: (status: string) => void;
  presenceByUserId?: Record<string, string>;
}) {
  const tagList = tags ?? [];
  const teammateList = teammates ?? [];
  const is = (k: string, key: string, sub?: string) => sel.kind === k && sel.key === key && (sub === undefined ? !sel.sub : sel.sub === sub);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pickMain = (kind: FilterSel["kind"], key: string, expandKey: string) => {
    onSel({ kind, key });
    setExpanded((p) => ({ ...p, [expandKey]: !p[expandKey] }));
  };

  const [presenceOpen, setPresenceOpen] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);
  const pillStyle = presencePillStyles(myPresenceStatus);
  const presenceDot = presenceColor(myPresenceStatus);

  useEffect(() => {
    if (!presenceOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (presenceRef.current?.contains(e.target as Node)) return;
      setPresenceOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [presenceOpen]);

  return (
    <div style={{ width: 216, borderRight: "1px solid var(--tv-border)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 14px 12px" }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, flex: 1, letterSpacing: -0.3, margin: 0, color: "var(--tv-text)" }}>Inbox</h1>
        <div style={{ position: "relative" }} ref={presenceRef}>
          <button
            className="tv-online-pill"
            title="Set your status"
            type="button"
            style={pillStyle}
            onClick={() => onPresenceChange && setPresenceOpen((v) => !v)}
          >
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: presenceDot }} />
            {presenceLabel(myPresenceStatus)}
          </button>
          {presenceOpen && onPresenceChange ? (
            <div
              className="ref-pop"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 6,
                background: "#fff",
                border: "1px solid var(--tv-border)",
                borderRadius: 10,
                padding: 6,
                minWidth: 160,
                boxShadow: "0 10px 28px rgba(16,24,40,.14)",
                zIndex: 30,
              }}
            >
              {(["available", "away", "busy", "dnd"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    onPresenceChange(status);
                    setPresenceOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "7px 10px",
                    border: "none",
                    background: myPresenceStatus === status ? "var(--tv-primary-soft)" : "transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: presenceColor(status) }} />
                  {presenceLabel(status)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 14px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--tv-faint)", pointerEvents: "none" }} />
          <input
            className="tv-input"
            placeholder="Search"
            style={{ padding: "7px 8px 7px 28px", borderRadius: 8 }}
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        <button className="tv-btn" style={{ padding: "7px 10px", borderRadius: 8, boxShadow: "0 1px 2px rgba(16,24,40,.1)" }} onClick={onNew} title="New Message"><MessageSquarePlus size={15} /></button>
        {onOpenSettings ? (
          <button className="tv-icon-btn" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--tv-border)" }} onClick={onOpenSettings} title="Inbox settings">
            <Settings size={15} />
          </button>
        ) : null}
      </div>
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        <Group title="MY CONVERSATIONS">
          <Item active={is("mine","all")} icon={<InboxIcon size={14}/>} label="All" count={counts.mineAll} onClick={() => onSel({ kind: "mine", key: "all" })} />
          <Item active={is("mine","unread")} icon={<MailQuestion size={14}/>} label="Unread" count={counts.mineUnread} onClick={() => onSel({ kind: "mine", key: "unread" })} />
          <Item active={is("mine","open")} icon={<MessageSquare size={14}/>} label="Open" count={counts.mineOpen} onClick={() => onSel({ kind: "mine", key: "open" })} />
          <Item active={is("mine","pending")} icon={<Clock size={14}/>} label="Pending" count={counts.minePending} onClick={() => onSel({ kind: "mine", key: "pending" })} />
        </Group>
        <Group title="ALL CONVERSATIONS">
          <Item active={is("all","all")} icon={<InboxIcon size={14}/>} label="All" count={counts.allAll} onClick={() => onSel({ kind: "all", key: "all" })} />
          <Item active={is("all","unassigned")} icon={<CircleSlash size={14}/>} label="Unassigned" count={counts.unassigned} onClick={() => onSel({ kind: "all", key: "unassigned" })} />
          <Item active={is("all","unread")} icon={<MailQuestion size={14}/>} label="Unread" count={counts.allUnread} onClick={() => onSel({ kind: "all", key: "unread" })} />
          <Item active={is("all","open")} icon={<MessageSquare size={14}/>} label="Open" count={counts.allOpen} onClick={() => onSel({ kind: "all", key: "open" })} />
          <Item active={is("all","pending")} icon={<Clock size={14}/>} label="Pending" count={counts.allPending} onClick={() => onSel({ kind: "all", key: "pending" })} />
          <Item active={is("all","closed")} icon={<CheckCircle2 size={14}/>} label="Closed" count={counts.closed} onClick={() => onSel({ kind: "all", key: "closed" })} />
          <Item active={is("all","snoozed")} icon={<AlarmClock size={14}/>} label="Snoozed" count={counts.snoozed} onClick={() => onSel({ kind: "all", key: "snoozed" })} />
          <Item active={is("all","spam")} icon={<Ban size={14}/>} label="Spam" count={counts.spam} onClick={() => onSel({ kind: "all", key: "spam" })} />
        </Group>
        <Group title="TAGGED CONVERSATIONS" defaultOpen>
          {tagList.map((t) => {
            const exp = !!expanded["tag:" + t.id] || (sel.kind === "tag" && sel.key === t.id && !!sel.sub);
            return (
              <div key={t.id}>
                <Item chevron expanded={exp} active={is("tag", t.id)}
                  icon={<TagIcon size={13} color={t.color} fill={t.color} style={{ opacity: .85 }} />}
                  label={t.name} count={counts["tag:" + t.id] ?? 0}
                  onClick={() => pickMain("tag", t.id, "tag:" + t.id)} />
                {exp && SUBS.map((s) => (
                  <Item key={s.key} indent active={is("tag", t.id, s.key)} icon={s.icon} label={s.label}
                    count={counts["tag:" + t.id + ":" + s.key] ?? 0}
                    onClick={() => onSel({ kind: "tag", key: t.id, sub: s.key === "all" ? undefined : s.key })} />
                ))}
              </div>
            );
          })}
        </Group>
        <Group title="TEAMMATE'S CONVERSATIONS">
          {teammateList.filter((t) => t.id !== "me").map((t) => {
            const exp = !!expanded["tm:" + t.id] || (sel.kind === "teammate" && sel.key === t.id && !!sel.sub);
            return (
              <div key={t.id}>
                <div onClick={() => pickMain("teammate", t.id, "tm:" + t.id)}
                  className={"tv-rail-item" + (is("teammate", t.id) ? " active" : "")}>
                  <span style={{ display: "flex", color: "var(--tv-faint)", marginLeft: -4 }}>{exp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                  <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.color, position: "relative" }}>{t.initials}
                    {presenceByUserId[t.id] ? (
                      <span style={{
                        position: "absolute", right: -1, bottom: -1, width: 7, height: 7, borderRadius: 9999,
                        background: presenceColor(presenceByUserId[t.id]!), border: "1.5px solid #fff",
                      }} />
                    ) : null}
                  </span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                  <span className="tv-count">{counts["tm:" + t.id] ?? 0}</span>
                </div>
                {exp && SUBS.filter((s) => s.key !== "closed").map((s) => (
                  <Item key={s.key} indent active={is("teammate", t.id, s.key)} icon={s.icon} label={s.label}
                    count={counts["tm:" + t.id + ":" + s.key] ?? 0}
                    onClick={() => onSel({ kind: "teammate", key: t.id, sub: s.key === "all" ? undefined : s.key })} />
                ))}
              </div>
            );
          })}
        </Group>
      </div>
    </div>
  );
}
