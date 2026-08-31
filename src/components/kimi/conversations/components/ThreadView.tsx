"use client";
import React, { useState } from "react";
import { ChevronDown, UserCheck, Tag as TagIcon, MoreVertical, EyeOff, Download, MessageSquare, FileText, CalendarDays, StickyNote, Users } from "lucide-react";
import { Conversation, Message, TAGS, TEAMMATES } from "../mock-data";
import { Popover, usePopover } from "./Popover";
import Composer from "./Composer";

type Filters = { inbox: boolean; other: boolean; notes: boolean; events: boolean; days: boolean };

export default function ThreadView({ convo, onUpdate, onToggleContact, contactOpen, onOpenTagsSettings }:{
  convo: Conversation; onUpdate: (c: Conversation)=>void; onToggleContact: ()=>void; contactOpen: boolean; onOpenTagsSettings: ()=>void;
}) {
  const [statusOpen, setStatusOpen] = usePopover();
  const [assignOpen, setAssignOpen] = usePopover();
  const [tagOpen, setTagOpen] = usePopover();
  const [moreOpen, setMoreOpen] = usePopover();
  const [filters, setFilters] = useState<Filters>({ inbox: true, other: true, notes: true, events: true, days: true });
  const [pendingTags, setPendingTags] = useState<string[]>(convo.tags);

  const ev = (text: string): Message => ({ id: "e" + Date.now() + Math.random(), kind: "event", eventText: text });
  const now = "On Tuesday, August 27th, 2024 @ 4:30 pm by Me";

  const setStatus = (s: Conversation["status"]) => {
    const label = s === "open" ? "Marked As Open" : s === "pending" ? "Marked As Pending" : "Marked As Closed";
    const msgs = [...convo.messages, ev(`${label} — ${now}`)];
    if (s === "closed") msgs.push(ev(`Conversation Unassigned to Me — ${now}`));
    onUpdate({ ...convo, status: s, assignee: s === "closed" ? null : convo.assignee, messages: msgs });
    setStatusOpen(false);
  };
  const assign = (id: string | null) => {
    const name = id === null ? "No One" : id === "me" ? "Me" : TEAMMATES.find((t) => t.id === id)?.name ?? "";
    onUpdate({ ...convo, assignee: id, messages: [...convo.messages, ev(`Conversation Assigned to ${name} — ${now}`)] });
    setAssignOpen(false);
  };
  const applyTags = () => {
    const added = pendingTags.filter((t) => !convo.tags.includes(t));
    const msgs = [...convo.messages, ...added.map((t) => ev(`Conversation Tagged as ${TAGS.find((x) => x.id === t)?.name} — ${now}`))];
    onUpdate({ ...convo, tags: pendingTags, messages: msgs });
    setTagOpen(false);
  };
  const send = (text: string) => onUpdate({ ...convo, messages: [...convo.messages, { id: "m" + Date.now(), kind: "outbound", author: "Me", text, time: "4:30 pm" }] });
  const note = (text: string) => onUpdate({ ...convo, messages: [...convo.messages, { id: "n" + Date.now(), kind: "note", author: "Note From Me", text, time: "Tuesday, August 27th, 2024 @ 4:30 pm" }] });
  const markUnread = () => { onUpdate({ ...convo, unread: true }); setMoreOpen(false); };

  const visible = convo.messages.filter((m) => {
    if (m.kind === "event") return filters.events;
    if (m.kind === "note") return filters.notes;
    if (m.kind === "day") return filters.days;
    if (m.kind === "mms" || m.kind === "other") return filters.other;
    return filters.inbox;
  });

  const assignee = TEAMMATES.find((t) => t.id === convo.assignee);
  const statusCls = convo.status === "open" ? "tv-status-open" : convo.status === "pending" ? "tv-status-pending" : "tv-status-closed";

  const Toggle = ({ on, onClick }:{ on: boolean; onClick: ()=>void }) => <button className={"tv-toggle" + (on ? " on" : "")} onClick={onClick} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--tv-border)" }}>
        <span className="tv-avatar" style={{ width: 32, height: 32, fontSize: 12, background: convo.color }}>{convo.initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{convo.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {convo.tags.map((tid) => {
              const t = TAGS.find((x) => x.id === tid); if (!t) return null;
              return <span key={tid} className="tv-chip"><TagIcon size={10} color={t.color} fill={t.color} />{t.name}</span>;
            })}
          </div>
        </div>
        {/* status */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen} width={200} trigger={
          <button className={"tv-status-btn " + statusCls} style={{ textTransform: "capitalize" }}>{convo.status} <ChevronDown size={13} /></button>
        }>
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>CONVERSATION STATUS</div>
            {(["pending", "closed", "open"] as const).filter((s) => s !== convo.status).map((s) => (
              <div key={s} onClick={() => setStatus(s)} style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, cursor: "pointer", textTransform: "capitalize" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>{s}</div>
            ))}
          </div>
        </Popover>
        {/* assign */}
        <Popover open={assignOpen} onOpenChange={setAssignOpen} width={220} trigger={
          <button className="tv-icon-btn" title="Assign" style={{ width: "auto", padding: "0 8px", gap: 6, display: "inline-flex" }}>
            {assignee ? <span className="tv-avatar" style={{ width: 18, height: 18, fontSize: 8, background: assignee.color }}>{assignee.initials}</span> : <UserCheck size={15} />}
            <ChevronDown size={12} />
          </button>
        }>
          <div style={{ padding: 8 }}>
            <input className="tv-input" placeholder="Search Teammates" style={{ marginBottom: 6, padding: "6px 10px" }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>ASSIGN CONVERSATION</div>
            {[{ id: null, name: "No One", initials: "—", color: "#9ca3af" }, ...TEAMMATES].map((t) => (
              <div key={t.id ?? "none"} onClick={() => assign(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.color }}>{t.initials}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {convo.assignee === t.id && <span style={{ color: "var(--tv-primary)", fontWeight: 800 }}>✓</span>}
              </div>
            ))}
          </div>
        </Popover>
        {/* tag */}
        <Popover open={tagOpen} onOpenChange={(v) => { setPendingTags(convo.tags); setTagOpen(v); }} width={240} trigger={
          <button className="tv-icon-btn" title="Tag"><TagIcon size={15} /></button>
        }>
          <div style={{ padding: 8 }}>
            <input className="tv-input" placeholder="Search Tags" style={{ marginBottom: 6, padding: "6px 10px" }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>TAG CONVERSATION</div>
            {TAGS.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}>
                <input type="checkbox" checked={pendingTags.includes(t.id)} style={{ accentColor: "var(--tv-primary)" }}
                  onChange={(e) => setPendingTags(e.target.checked ? [...pendingTags, t.id] : pendingTags.filter((x) => x !== t.id))} />
                <TagIcon size={12} color={t.color} fill={t.color} />{t.name}
              </label>
            ))}
            <button className="tv-btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={applyTags}>Set Tags</button>
          </div>
        </Popover>
        <button className="tv-icon-btn" onClick={onToggleContact} title="Contact Details" style={{ color: contactOpen ? "var(--tv-primary)" : undefined, borderColor: contactOpen ? "var(--tv-primary)" : undefined }}>
          <Users size={15} />
        </button>
        {/* more */}
        <Popover open={moreOpen} onOpenChange={setMoreOpen} width={250} trigger={<button className="tv-icon-btn"><MoreVertical size={15} /></button>}>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>MARK CONVERSATION</div>
            <div onClick={markUnread} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
              <EyeOff size={14} color="#6b7280" /> Unread
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "8px 8px 4px" }}>DOWNLOADS</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
              <Download size={14} color="#6b7280" /> Message Transcript
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "8px 8px 4px" }}>CONVERSATION FILTERS</div>
            {([
              ["inbox", "Inbox Messages", <MessageSquare key="i" size={14} color="#6b7280" />],
              ["other", "Other Messages", <MessageSquare key="o" size={14} color="#6b7280" />],
              ["notes", "Notes", <StickyNote key="n" size={14} color="#6b7280" />],
              ["events", "Events", <FileText key="e" size={14} color="#6b7280" />],
              ["days", "Day Markers", <CalendarDays key="d" size={14} color="#6b7280" />],
            ] as const).map(([k, label, icon]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13 }}>
                {icon}<span style={{ flex: 1 }}>{label}</span>
                <Toggle on={filters[k]} onClick={() => setFilters({ ...filters, [k]: !filters[k] })} />
              </div>
            ))}
          </div>
        </Popover>
      </div>

      {/* messages */}
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#fbfcfd" }}>
        {visible.map((m) => {
          if (m.kind === "day") return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--tv-border)" }} />
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{m.eventText}</span>
              <div style={{ flex: 1, height: 1, background: "var(--tv-border)" }} />
            </div>
          );
          if (m.kind === "event") {
            const [title, sub] = (m.eventText ?? "").split(" — ");
            return <div key={m.id} className="tv-event"><span>{title}</span>{sub && <span>{sub}</span>}</div>;
          }
          if (m.kind === "note") return (
            <div key={m.id} style={{ margin: "10px 0", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{m.author} · {m.time}</span>
              <div style={{ background: "var(--tv-note)", border: "1px solid var(--tv-note-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#78350f", maxWidth: "75%", display: "flex", gap: 8 }}>
                <StickyNote size={14} style={{ flexShrink: 0, marginTop: 2 }} />{m.text}
              </div>
            </div>
          );
          if (m.kind === "mms") return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", margin: "10px 0" }}>
              <span style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{m.author} · {m.time}</span>
              <div style={{ background: "#374151", color: "#e5e7eb", borderRadius: "12px 12px 4px 12px", padding: "10px 14px", fontSize: 13, maxWidth: "70%" }}>{m.caption}</div>
              <img src={m.image} alt="MMS" style={{ width: 220, borderRadius: 10, marginTop: 6, border: "1px solid var(--tv-border)" }} />
            </div>
          );
          const out = m.kind === "outbound";
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", margin: "10px 0" }}>
              <span style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{m.author} · {m.time}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: out ? "row-reverse" : "row" }}>
                {!out && <span className="tv-avatar" style={{ width: 24, height: 24, fontSize: 9, background: convo.color }}>{m.initials}</span>}
                <div style={{
                  borderRadius: out ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "9px 14px", fontSize: 13, maxWidth: "70%",
                  background: out ? "var(--tv-primary)" : "#f3f4f6", color: out ? "#fff" : "#111827",
                }}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <Composer onSend={send} onNote={note} />
    </div>
  );
}
