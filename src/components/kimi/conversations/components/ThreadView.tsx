"use client";
import React, { useState } from "react";
import { ChevronDown, UserCheck, Tag as TagIcon, MoreVertical, EyeOff, Download, MessageSquare, FileText, CalendarDays, StickyNote, Users, Check } from "lucide-react";
import type { Conversation, Message, Tag, Teammate } from "@/lib/inbox/conversation-types";
import { Popover, usePopover } from "./Popover";
import Composer from "./Composer";

type Filters = { inbox: boolean; other: boolean; notes: boolean; events: boolean; days: boolean };

const MenuItem = ({ children, onClick }:{ children: React.ReactNode; onClick?: ()=>void }) => (
  <div className="tv-menu-item" onClick={onClick}>{children}</div>
);

export default function ThreadView({ convo, onUpdate, onToggleContact, contactOpen, onOpenTagsSettings, onDownloadTranscript, tags: tagsProp, teammates: teammatesProp, liveMode, ComposerSlot, allowAssign = true, allowTag = true, composerDisabled = false, onBack }:{
  convo: Conversation; onUpdate: (c: Conversation)=>void; onToggleContact: ()=>void; contactOpen: boolean; onOpenTagsSettings: ()=>void;
  onDownloadTranscript?: () => void;
  tags?: Tag[]; teammates?: Teammate[];
  liveMode?: boolean;
  ComposerSlot?: React.ComponentType<{ onSend: (t: string, mediaUrls?: string[]) => void; onNote: (t: string) => void; disabled?: boolean }>;
  allowAssign?: boolean;
  allowTag?: boolean;
  composerDisabled?: boolean;
  onBack?: () => void;
}) {
  const tagCatalog = tagsProp ?? [];
  const teammateCatalog = teammatesProp ?? [];
  const [statusOpen, setStatusOpen] = usePopover();
  const [assignOpen, setAssignOpen] = usePopover();
  const [tagOpen, setTagOpen] = usePopover();
  const [moreOpen, setMoreOpen] = usePopover();
  const [filters, setFilters] = useState<Filters>({ inbox: true, other: true, notes: true, events: true, days: true });
  const [pendingTags, setPendingTags] = useState<string[]>(convo.tags);
  const [teammateQuery, setTeammateQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  const filteredTeammates = teammateCatalog.filter((t) =>
    !teammateQuery.trim() ? true : t.name.toLowerCase().includes(teammateQuery.trim().toLowerCase()),
  );
  const filteredTagCatalog = tagCatalog.filter((t) =>
    !tagQuery.trim()
      ? true
      : t.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) ||
        t.description.toLowerCase().includes(tagQuery.trim().toLowerCase()),
  );

  const ev = (text: string): Message => ({ id: "e" + Date.now() + Math.random(), kind: "event", eventText: text });
  const now = liveMode
    ? new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " by Me"
    : "On Tuesday, August 27th, 2024 @ 4:30 pm by Me";

  const setStatus = (s: Conversation["status"]) => {
    const label = s === "open" ? "Marked As Open" : s === "pending" ? "Marked As Pending" : "Marked As Closed";
    const msgs = liveMode
      ? convo.messages
      : [...convo.messages, ev(`${label} — ${now}`)];
    if (!liveMode && s === "closed") msgs.push(ev(`Conversation Unassigned to Me — ${now}`));
    onUpdate({ ...convo, status: s, assignee: s === "closed" ? null : convo.assignee, messages: msgs });
    setStatusOpen(false);
  };
  const assign = (id: string | null) => {
    const name = id === null ? "No One" : id === "me" ? "Me" : teammateCatalog.find((t) => t.id === id)?.name ?? "";
    const msgs = liveMode
      ? convo.messages
      : [...convo.messages, ev(`Conversation Assigned to ${name} — ${now}`)];
    onUpdate({ ...convo, assignee: id, messages: msgs });
    setAssignOpen(false);
  };
  const applyTags = () => {
    const added = pendingTags.filter((t) => !convo.tags.includes(t));
    const msgs = liveMode
      ? convo.messages
      : [...convo.messages, ...added.map((t) => ev(`Conversation Tagged as ${tagCatalog.find((x) => x.id === t)?.name} — ${now}`))];
    onUpdate({ ...convo, tags: pendingTags, messages: msgs });
    setTagOpen(false);
  };
  const send = (text: string, mediaUrls?: string[]) => {
    const time = liveMode ? new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "4:30 pm";
    const msg: Message = mediaUrls?.length
      ? { id: "m" + Date.now(), kind: "mms", author: "Me", image: mediaUrls[0], caption: text, time }
      : { id: "m" + Date.now(), kind: "outbound", author: "Me", text, time };
    onUpdate({ ...convo, messages: [...convo.messages, msg] });
  };
  const note = (text: string) => onUpdate({ ...convo, messages: [...convo.messages, { id: "n" + Date.now(), kind: "note", author: "Note From Me", text, time: liveMode ? new Date().toLocaleString() : "Tuesday, August 27th, 2024 @ 4:30 pm" }] });
  const markUnread = () => { onUpdate({ ...convo, unread: true }); setMoreOpen(false); };

  const visible = convo.messages.filter((m) => {
    if (m.kind === "event") return filters.events;
    if (m.kind === "note") return filters.notes;
    if (m.kind === "day") return filters.days;
    if (m.kind === "mms" || m.kind === "other") return filters.other;
    return filters.inbox;
  });

  const assignee = teammateCatalog.find((t) => t.id === convo.assignee);
  const statusCls =
    convo.status === "open"
      ? "tv-status-open"
      : convo.status === "pending"
        ? "tv-status-pending"
        : convo.status === "snoozed"
          ? "tv-status-pending"
          : convo.status === "spam"
            ? "tv-status-closed"
            : "tv-status-closed";

  const Toggle = ({ on, onClick }:{ on: boolean; onClick: ()=>void }) => <button className={"tv-toggle" + (on ? " on" : "")} onClick={onClick} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--tv-border)", minHeight: 57 }}>
        {onBack ? (
          <button type="button" className="tv-btn-ghost" onClick={onBack} style={{ padding: "4px 8px", fontSize: 12 }}>
            ← Back
          </button>
        ) : null}
        <span className="tv-avatar" style={{ width: 32, height: 32, fontSize: 12, background: convo.color }}>{convo.initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.1 }}>{convo.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
            {convo.productSourceLabel ? (
              <span className="tv-chip" style={{ fontSize: 10 }}>{convo.productSourceLabel}</span>
            ) : null}
            {convo.campaignName ? (
              <span className="tv-chip" style={{ fontSize: 10 }}>Campaign: {convo.campaignName}</span>
            ) : null}
            {convo.repeatCaller ? (
              <span className="tv-chip" style={{ fontSize: 10, color: "#b45309" }}>
                Repeat caller ({convo.repeatCaller.missedToday} today)
              </span>
            ) : null}
            {convo.tags.map((tid) => {
              const t = tagCatalog.find((x) => x.id === tid); if (!t) return null;
              return <span key={tid} className="tv-chip"><TagIcon size={10} color={t.color} fill={t.color} />{t.name}</span>;
            })}
          </div>
        </div>
        {/* status */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen} width={200} trigger={
          <button className={"tv-status-btn " + statusCls} style={{ textTransform: "capitalize" }}>{convo.status} <ChevronDown size={13} /></button>
        }>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">CONVERSATION STATUS</div>
            {(["pending", "closed", "snoozed", "spam", "open"] as const).filter((s) => s !== convo.status).map((s) => (
              <MenuItem key={s} onClick={() => setStatus(s)}><span style={{ textTransform: "capitalize" }}>{s}</span></MenuItem>
            ))}
          </div>
        </Popover>
        {/* assign */}
        {allowAssign ? (
        <Popover open={assignOpen} onOpenChange={setAssignOpen} width={220} trigger={
          <button className="tv-icon-btn" title="Assign" style={{ width: "auto", padding: "0 8px", gap: 6, display: "inline-flex" }}>
            {assignee ? <span className="tv-avatar" style={{ width: 18, height: 18, fontSize: 8, background: assignee.color }}>{assignee.initials}</span> : <UserCheck size={15} />}
            <ChevronDown size={12} />
          </button>
        }>
          <div style={{ padding: 8 }}>
            <input className="tv-input" placeholder="Search Teammates" style={{ marginBottom: 6, padding: "6px 10px" }} value={teammateQuery} onChange={(e) => setTeammateQuery(e.target.value)} />
            <div className="tv-menu-label">ASSIGN CONVERSATION</div>
            {[{ id: null, name: "No One", initials: "—", color: "#9ca3af" }, ...filteredTeammates].map((t) => (
              <MenuItem key={t.id ?? "none"} onClick={() => assign(t.id)}>
                <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.color }}>{t.initials}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {convo.assignee === t.id && <Check size={14} color="var(--tv-primary)" strokeWidth={3} />}
              </MenuItem>
            ))}
          </div>
        </Popover>
        ) : null}
        {allowTag ? (
        <Popover open={tagOpen} onOpenChange={(v) => { setPendingTags(convo.tags); setTagOpen(v); }} width={240} trigger={
          <button className="tv-icon-btn" title="Tag"><TagIcon size={15} /></button>
        }>
          <div style={{ padding: 8 }}>
            <input className="tv-input" placeholder="Search Tags" style={{ marginBottom: 6, padding: "6px 10px" }} value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} />
            <div className="tv-menu-label">TAG CONVERSATION</div>
            {filteredTagCatalog.map((t) => (
              <label key={t.id} className="tv-menu-item" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={pendingTags.includes(t.id)} style={{ accentColor: "var(--tv-primary)" }}
                  onChange={(e) => setPendingTags(e.target.checked ? [...pendingTags, t.id] : pendingTags.filter((x) => x !== t.id))} />
                <TagIcon size={12} color={t.color} fill={t.color} />{t.name}
              </label>
            ))}
            <button className="tv-btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={applyTags}>Set Tags</button>
            {onOpenTagsSettings ? (
              <button
                type="button"
                className="tv-btn-ghost"
                style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12 }}
                onClick={() => { setTagOpen(false); onOpenTagsSettings(); }}
              >
                Manage tags
              </button>
            ) : null}
          </div>
        </Popover>
        ) : null}
        <button className={"tv-icon-btn" + (contactOpen ? " active" : "")} onClick={onToggleContact} title="Contact Details">
          <Users size={15} />
        </button>
        {/* more */}
        <Popover open={moreOpen} onOpenChange={setMoreOpen} width={250} trigger={<button className="tv-icon-btn"><MoreVertical size={15} /></button>}>
          <div style={{ padding: 8 }}>
            <div className="tv-menu-label">MARK CONVERSATION</div>
            <MenuItem onClick={markUnread}><EyeOff size={14} color="#6b7280" /> Unread</MenuItem>
            <div className="tv-menu-label" style={{ paddingTop: 8 }}>DOWNLOADS</div>
            <MenuItem onClick={onDownloadTranscript}><Download size={14} color="#6b7280" /> Message Transcript</MenuItem>
            <div className="tv-menu-label" style={{ paddingTop: 8 }}>CONVERSATION FILTERS</div>
            {([
              ["inbox", "Inbox Messages", <MessageSquare key="i" size={14} color="#6b7280" />],
              ["other", "Other Messages", <MessageSquare key="o" size={14} color="#6b7280" />],
              ["notes", "Notes", <StickyNote key="n" size={14} color="#6b7280" />],
              ["events", "Events", <FileText key="e" size={14} color="#6b7280" />],
              ["days", "Day Markers", <CalendarDays key="d" size={14} color="#6b7280" />],
            ] as const).map(([k, label, icon]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, color: "var(--tv-text-2)" }}>
                {icon}<span style={{ flex: 1 }}>{label}</span>
                <Toggle on={filters[k]} onClick={() => setFilters({ ...filters, [k]: !filters[k] })} />
              </div>
            ))}
          </div>
        </Popover>
      </div>

      {/* messages */}
      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "var(--tv-panel)" }}>
        {visible.map((m) => {
          if (m.kind === "day") return (
            <div key={m.id} className="tv-day-divider"><span>{m.eventText}</span></div>
          );
          if (m.kind === "event") {
            const [title, sub] = (m.eventText ?? "").split(" — ");
            return <div key={m.id} className="tv-event"><span>{title}</span>{sub && <span>{sub}</span>}</div>;
          }
          if (m.kind === "note") return (
            <div key={m.id} style={{ margin: "12px 0", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 11, color: "var(--tv-faint)", marginBottom: 4 }}>{m.author} · {m.time}</span>
              <div className="tv-note-bubble">
                <StickyNote size={14} style={{ flexShrink: 0, marginTop: 2 }} color="#d97706" />
                <span>{m.text}</span>
              </div>
            </div>
          );
          if (m.kind === "mms") return (
            <div key={m.id} className="tv-msg-row out">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "72%" }}>
                {m.image && <img src={m.image} alt="" className="tv-mms-img" />}
                {m.caption && (
                  <div className="tv-bubble tv-bubble-out" style={{ marginTop: 6 }}>{m.caption}</div>
                )}
                <div className="tv-msg-meta"><span>{m.author}{m.isAi ? " · AI" : ""}</span><span>·</span><span>{m.time}</span></div>
              </div>
            </div>
          );
          const out = m.kind === "outbound";
          return (
            <div key={m.id} className={"tv-msg-row" + (out ? " out" : "")}>
              {!out && <span className="tv-avatar" style={{ width: 26, height: 26, fontSize: 10, background: convo.color }}>{m.initials ?? convo.initials}</span>}
              <div style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                <div className={"tv-bubble " + (out ? "tv-bubble-out" : "tv-bubble-in")}>{m.text}</div>
                <div className="tv-msg-meta"><span>{m.author}{m.isAi ? " · AI" : ""}</span><span>·</span><span>{m.time}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {ComposerSlot ? <ComposerSlot onSend={send} onNote={note} disabled={composerDisabled} /> : <Composer onSend={(t) => send(t)} onNote={note} />}
    </div>
  );
}
