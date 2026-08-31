"use client";
import React, { useState } from "react";
import { ChevronDown, UserCheck, Tag as TagIcon, MoreVertical, EyeOff, Download, MessageSquare, FileText, CalendarDays, StickyNote, Users, Check } from "lucide-react";
import type { Conversation, Tag, Teammate } from "../mock-data";
import { Popover, usePopover } from "./Popover";
import Composer from "./Composer";

type Filters = { inbox: boolean; other: boolean; notes: boolean; events: boolean; days: boolean };

const MenuItem = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <div className="tv-menu-item" onClick={onClick}>{children}</div>
);

export default function ThreadView({
  convo,
  tags,
  teammates,
  sending = false,
  onSendReply,
  onSendNote,
  onStatusChange,
  onAssign,
  onTagsChange,
  onMarkUnread,
  onDownloadTranscript,
  onToggleContact,
  contactOpen,
  onOpenTagsSettings,
  onAttach,
}: {
  convo: Conversation;
  tags: Tag[];
  teammates: Teammate[];
  sending?: boolean;
  onSendReply: (text: string, mediaUrls?: string[]) => Promise<void>;
  onSendNote: (text: string) => Promise<void>;
  onStatusChange: (status: Conversation["status"]) => Promise<void>;
  onAssign: (assigneeId: string | null) => Promise<void>;
  onTagsChange: (tags: string[]) => Promise<void>;
  onMarkUnread: () => Promise<void>;
  onDownloadTranscript: () => void;
  onToggleContact: () => void;
  contactOpen: boolean;
  onOpenTagsSettings: () => void;
  onAttach?: () => void;
}) {
  const [statusOpen, setStatusOpen] = usePopover();
  const [assignOpen, setAssignOpen] = usePopover();
  const [tagOpen, setTagOpen] = usePopover();
  const [moreOpen, setMoreOpen] = usePopover();
  const [filters, setFilters] = useState<Filters>({ inbox: true, other: true, notes: true, events: true, days: true });
  const [pendingTags, setPendingTags] = useState<string[]>(convo.tags);

  const visible = convo.messages.filter((m) => {
    if (m.kind === "event") return filters.events;
    if (m.kind === "note") return filters.notes;
    if (m.kind === "day") return filters.days;
    if (m.kind === "mms" || m.kind === "other") return filters.other;
    return filters.inbox;
  });

  const assignee = teammates.find((t) => t.id === convo.assignee);
  const statusCls = convo.status === "open" ? "tv-status-open" : convo.status === "pending" ? "tv-status-pending" : "tv-status-closed";

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button type="button" className={"tv-toggle" + (on ? " on" : "")} onClick={onClick} />
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--tv-border)", minHeight: 57 }}>
        <span className="tv-avatar" style={{ width: 32, height: 32, fontSize: 12, background: convo.color }}>{convo.initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.1 }}>{convo.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {convo.tags.map((tid) => {
              const t = tags.find((x) => x.id === tid);
              if (!t) {
                return (
                  <span key={tid} className="tv-chip">
                    <TagIcon size={10} />{tid}
                  </span>
                );
              }
              return (
                <span key={tid} className="tv-chip">
                  <TagIcon size={10} color={t.color} fill={t.color} />{t.name}
                </span>
              );
            })}
          </div>
        </div>
        <Popover open={statusOpen} onOpenChange={setStatusOpen} width={200} trigger={
          <button type="button" className={"tv-status-btn " + statusCls} style={{ textTransform: "capitalize" }}>{convo.status} <ChevronDown size={13} /></button>
        }>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">CONVERSATION STATUS</div>
            {(["pending", "closed", "open"] as const).filter((s) => s !== convo.status).map((s) => (
              <MenuItem key={s} onClick={() => { void onStatusChange(s); setStatusOpen(false); }}>
                <span style={{ textTransform: "capitalize" }}>{s}</span>
              </MenuItem>
            ))}
          </div>
        </Popover>
        <Popover open={assignOpen} onOpenChange={setAssignOpen} width={220} trigger={
          <button type="button" className="tv-icon-btn" title="Assign" style={{ width: "auto", padding: "0 8px", gap: 6, display: "inline-flex" }}>
            {assignee ? <span className="tv-avatar" style={{ width: 18, height: 18, fontSize: 8, background: assignee.color }}>{assignee.initials}</span> : <UserCheck size={15} />}
            <ChevronDown size={12} />
          </button>
        }>
          <div style={{ padding: 8 }}>
            <div className="tv-menu-label">ASSIGN CONVERSATION</div>
            {[{ id: null, name: "No One", initials: "—", color: "#9ca3af" }, ...teammates].map((t) => (
              <MenuItem key={t.id ?? "none"} onClick={() => { void onAssign(t.id); setAssignOpen(false); }}>
                <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.color }}>{t.initials}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {convo.assignee === t.id && <Check size={14} color="var(--tv-primary)" strokeWidth={3} />}
              </MenuItem>
            ))}
          </div>
        </Popover>
        <Popover open={tagOpen} onOpenChange={(v) => { setPendingTags(convo.tags); setTagOpen(v); }} width={240} trigger={
          <button type="button" className="tv-icon-btn" title="Tag"><TagIcon size={15} /></button>
        }>
          <div style={{ padding: 8 }}>
            <div className="tv-menu-label">TAG CONVERSATION</div>
            {tags.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--tv-faint)", padding: "6px 10px" }}>
                No tags yet. <button type="button" onClick={onOpenTagsSettings} style={{ color: "var(--tv-primary)", background: "none", border: "none", cursor: "pointer" }}>Manage tags</button>
              </p>
            ) : tags.map((t) => (
              <label key={t.id} className="tv-menu-item" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pendingTags.includes(t.id)}
                  style={{ accentColor: "var(--tv-primary)" }}
                  onChange={(e) => setPendingTags(e.target.checked ? [...pendingTags, t.id] : pendingTags.filter((x) => x !== t.id))}
                />
                <TagIcon size={12} color={t.color} fill={t.color} />{t.name}
              </label>
            ))}
            <button type="button" className="tv-btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => { void onTagsChange(pendingTags); setTagOpen(false); }}>Set Tags</button>
          </div>
        </Popover>
        <button type="button" className={"tv-icon-btn" + (contactOpen ? " active" : "")} onClick={onToggleContact} title="Contact Details">
          <Users size={15} />
        </button>
        <Popover open={moreOpen} onOpenChange={setMoreOpen} width={250} trigger={<button type="button" className="tv-icon-btn"><MoreVertical size={15} /></button>}>
          <div style={{ padding: 8 }}>
            <div className="tv-menu-label">MARK CONVERSATION</div>
            <MenuItem onClick={() => { void onMarkUnread(); setMoreOpen(false); }}><EyeOff size={14} color="#6b7280" /> Unread</MenuItem>
            <div className="tv-menu-label" style={{ paddingTop: 8 }}>DOWNLOADS</div>
            <MenuItem onClick={() => { onDownloadTranscript(); setMoreOpen(false); }}><Download size={14} color="#6b7280" /> Message Transcript</MenuItem>
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

      <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "var(--tv-panel)" }}>
        {visible.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--tv-faint)", marginTop: 40 }}>No messages in this conversation yet.</p>
        ) : visible.map((m) => {
          if (m.kind === "day") return <div key={m.id} className="tv-day-divider"><span>{m.eventText}</span></div>;
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
                {m.caption && <div className="tv-bubble tv-bubble-out" style={{ marginTop: 6 }}>{m.caption}</div>}
                <div className="tv-msg-meta"><span>{m.author}</span><span>·</span><span>{m.time}</span></div>
              </div>
            </div>
          );
          const out = m.kind === "outbound";
          return (
            <div key={m.id} className={"tv-msg-row" + (out ? " out" : "")}>
              {!out && <span className="tv-avatar" style={{ width: 26, height: 26, fontSize: 10, background: convo.color }}>{m.initials ?? convo.initials}</span>}
              <div style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                <div className={"tv-bubble " + (out ? "tv-bubble-out" : "tv-bubble-in")}>{m.text}</div>
                <div className="tv-msg-meta"><span>{m.author}</span><span>·</span><span>{m.time}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <Composer onSend={onSendReply} onNote={onSendNote} sending={sending} onAttach={onAttach} />
    </div>
  );
}
