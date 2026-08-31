"use client";
import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, MessageSquarePlus, Inbox as InboxIcon, MailQuestion, MessageSquare, Clock, CheckCircle2, Tag as TagIcon, CircleSlash } from "lucide-react";
import { TAGS, TEAMMATES } from "../mock-data";

export type FilterSel = { kind: "mine" | "all" | "tag" | "teammate"; key: string; sub?: string };

const Item = ({ active, icon, label, count, onClick, indent, chevron, expanded }:{
  active?: boolean; icon?: React.ReactNode; label: string; count?: number; onClick?: ()=>void; indent?: boolean;
  chevron?: boolean; expanded?: boolean;
}) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 8, padding: indent ? "4px 10px 4px 26px" : "5px 10px",
    borderRadius: 6, fontSize: 13, cursor: "pointer",
    background: active ? "#eef2ff" : "transparent", color: active ? "var(--tv-primary)" : "#374151",
    fontWeight: active ? 600 : 400,
  }}>
    {chevron !== undefined && (
      <span style={{ display: "flex", color: "#9ca3af", marginLeft: -4 }}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
    )}
    {icon && <span style={{ display: "flex", color: active ? "var(--tv-primary)" : "#9ca3af" }}>{icon}</span>}
    <span style={{ flex: 1 }}>{label}</span>
    {count !== undefined && <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{count}</span>}
  </div>
);

const Group = ({ title, children, defaultOpen = true }:{ title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 10 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "#9ca3af", cursor: "pointer" }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{title}
      </div>
      {open && <div style={{ marginTop: 2 }}>{children}</div>}
    </div>
  );
};

const SUBS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <InboxIcon size={13} /> },
  { key: "open", label: "Open", icon: <MessageSquare size={13} /> },
  { key: "pending", label: "Pending", icon: <Clock size={13} /> },
  { key: "closed", label: "Closed", icon: <CheckCircle2 size={13} /> },
];

export default function InboxRail({ sel, onSel, counts, onNew, tags }:{
  sel: FilterSel; onSel: (s: FilterSel)=>void; counts: Record<string, number>; onNew: ()=>void; tags?: typeof TAGS;
}) {
  const tagList = tags ?? TAGS;
  const is = (k: string, key: string, sub?: string) => sel.kind === k && sel.key === key && (sub === undefined ? !sel.sub : sel.sub === sub);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pickMain = (kind: FilterSel["kind"], key: string, expandKey: string) => {
    onSel({ kind, key });
    setExpanded((p) => ({ ...p, [expandKey]: !p[expandKey] }));
  };

  return (
    <div style={{ width: 208, borderRight: "1px solid var(--tv-border)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 8px" }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Inbox</h1>
        <button style={{ border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#059669", borderRadius: 9999, fontSize: 11, fontWeight: 600, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#10b981" }} />Online <ChevronDown size={11} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "#9ca3af" }} />
          <input className="tv-input" placeholder="Search" style={{ paddingLeft: 28, padding: "7px 8px 7px 28px" }} />
        </div>
        <button className="tv-btn" style={{ padding: "7px 10px" }} onClick={onNew} title="New Message"><MessageSquarePlus size={15} /></button>
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
        </Group>
        <Group title="TAGGED CONVERSATIONS" defaultOpen>
          {tagList.map((t) => {
            const exp = !!expanded["tag:" + t.id] || (sel.kind === "tag" && sel.key === t.id && !!sel.sub);
            return (
              <div key={t.id}>
                <Item chevron expanded={exp} active={is("tag", t.id)}
                  icon={<TagIcon size={13} color={t.color} fill={t.color} style={{ opacity: .8 }} />}
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
          {TEAMMATES.filter((t) => t.id !== "me").map((t) => {
            const exp = !!expanded["tm:" + t.id] || (sel.kind === "teammate" && sel.key === t.id && !!sel.sub);
            return (
              <div key={t.id}>
                <div onClick={() => pickMain("teammate", t.id, "tm:" + t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                    background: is("teammate", t.id) ? "#eef2ff" : "transparent", color: is("teammate", t.id) ? "var(--tv-primary)" : "#374151" }}>
                  <span style={{ display: "flex", color: "#9ca3af", marginLeft: -4 }}>{exp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                  <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.color }}>{t.initials}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{counts["tm:" + t.id] ?? 0}</span>
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
