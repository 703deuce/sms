"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Download, EyeOff, MailOpen, MessageSquare, MoreHorizontal,
  Search, Sparkles, Tag as TagIcon, UserRound, Users, CalendarClock, Paperclip,
} from "lucide-react";
import type { Conversation, Message, Tag, Teammate } from "../mock-data";
import { Popover, usePopover } from "./Popover";
import { Composer } from "./Composer";
import { AiAssistPanel } from "./AiAssistPanel";

function StatusChip({ status }: { status: Conversation["status"] }) {
  const map = {
    Open: { bg: "var(--tv-green-soft)", color: "var(--tv-green)", border: "#a7f3d0" },
    Pending: { bg: "var(--tv-amber-soft)", color: "var(--tv-amber)", border: "#fde68a" },
    Closed: { bg: "var(--tv-bg)", color: "var(--tv-muted)", border: "var(--tv-border)" },
  }[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: map.bg, color: map.color, border: `1px solid ${map.border}` }}>
      {status}
    </span>
  );
}

function Bubble({ m, convo }: { m: Message; convo: Conversation }) {
  if (m.kind === "day") return <div className="tv-day">{m.body}</div>;
  if (m.kind === "event") return <div className="tv-event">{m.body}{m.time ? ` · ${m.time}` : ""}</div>;
  const out = m.kind === "outbound" || m.kind === "note";
  const attachments = m.body.startsWith("__media__") ? m.body.slice(9).split("|") : null;
  return (
    <div className={"tv-msg-row" + (out ? " out" : "")}>
      <span className="tv-msg-av" aria-hidden>{out ? "ME" : convo.initials}</span>
      <div>
        {attachments ? (
          <div className={"tv-bubble " + (m.kind === "note" ? "note" : "out")} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {attachments.map((a) => (
              <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <Paperclip size={11} /> {a}
              </span>
            ))}
          </div>
        ) : (
          <div className={"tv-bubble " + (m.kind === "inbound" ? "in" : m.kind === "note" ? "note" : "out")}>
            {m.kind === "note" ? <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#b45309", marginBottom: 3 }}>Note from {m.sender}</div> : null}
            {m.body}
          </div>
        )}
        <div className="tv-msg-meta">{m.sender} · {m.time}{out && m.kind === "outbound" ? " · Delivered" : ""}</div>
      </div>
    </div>
  );
}

export function ThreadView({
  convo, tags, teammates, onUpdate, onOpenContact, onOpenTagsSettings, onBack,
}: {
  convo: Conversation; tags: Tag[]; teammates: Teammate[];
  onUpdate: (c: Conversation) => void;
  onOpenContact: () => void; onOpenTagsSettings: () => void;
  onBack?: () => void;
}) {
  const [prefill, setPrefill] = useState("");
  const [downloadMsg, setDownloadMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const statusPop = usePopover();
  const assignPop = usePopover();
  const tagPop = usePopover();
  const morePop = usePopover();
  const [assignQ, setAssignQ] = useState("");
  const [tagQ, setTagQ] = useState("");
  const [filters, setFilters] = useState({ inbox: true, other: true, notes: true, events: true, day: true });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convo.id, convo.messages.length]);

  const ev = (body: string): Message => ({ id: Math.random().toString(36).slice(2), kind: "event", body, time: "now" });

  const setStatus = (s: Conversation["status"]) => {
    let nextTags = convo.tags;
    if (s === "Closed") {
      const untag = tags.filter((t) => t.untagOnClose).map((t) => t.name);
      nextTags = convo.tags.filter((t) => !untag.includes(t));
    }
    onUpdate({ ...convo, status: s, tags: nextTags, messages: [...convo.messages, ev(`Marked As ${s}`)] });
    statusPop.setOpen(false);
  };

  const assign = (name: string | null) => {
    onUpdate({
      ...convo, assignee: name,
      messages: [...convo.messages, ev(name ? `Conversation Assigned to ${name}` : "Conversation Unassigned")],
    });
    assignPop.setOpen(false);
  };

  const toggleTag = (name: string) => {
    const has = convo.tags.includes(name);
    onUpdate({
      ...convo,
      tags: has ? convo.tags.filter((t) => t !== name) : [...convo.tags, name],
      messages: [...convo.messages, ev(has ? `Conversation Untagged from ${name}` : `Conversation Tagged as ${name}`)],
    });
  };

  const send = (text: string, mediaUrls?: string[]) => {
    const msgs: Message[] = [];
    if (text) msgs.push({ id: Math.random().toString(36).slice(2), kind: "outbound", body: text, time: "now", sender: "Me" });
    if (mediaUrls?.length) msgs.push({ id: Math.random().toString(36).slice(2), kind: "outbound", body: "__media__" + mediaUrls.join("|"), time: "now", sender: "Me" });
    onUpdate({ ...convo, unread: false, preview: text || mediaUrls?.[0] || convo.preview, messages: [...convo.messages, ...msgs] });
  };
  const note = (text: string) => {
    onUpdate({ ...convo, messages: [...convo.messages, { id: Math.random().toString(36).slice(2), kind: "note", body: text, time: "now", sender: "Me" }] });
  };

  const downloadTranscript = () => {
    const lines = convo.messages
      .filter((m) => m.kind !== "day")
      .map((m) => `[${m.time || "-"}] ${m.sender ?? "System"}: ${m.body.startsWith("__media__") ? "(attachment) " + m.body.slice(9).replace(/\|/g, ", ") : m.body}`)
      .join("\n");
    const blob = new Blob([`Transcript — ${convo.name} (${convo.phone})\n\n${lines}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${convo.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    morePop.setOpen(false);
    setDownloadMsg("Transcript downloaded.");
    setTimeout(() => setDownloadMsg(""), 2500);
  };

  const visible = convo.messages.filter((m) => {
    if (m.kind === "day") return filters.day;
    if (m.kind === "event") return filters.events;
    if (m.kind === "note") return filters.notes;
    if (m.kind === "inbound") return filters.inbox;
    return filters.other;
  });

  const filterDefs: Array<[keyof typeof filters, string]> = [
    ["inbox", "Inbox Messages"], ["other", "Other Messages"], ["notes", "Notes"], ["events", "Events"], ["day", "Day Markers"],
  ];

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
      <section className="tv-thread" aria-label={`Conversation with ${convo.name}`}>
        <header className="tv-thread-head">
          {onBack ? (
            <button type="button" className="tv-iconbtn tv-backbtn" onClick={onBack} aria-label="Back to conversation list">
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <span className="tv-avatar" style={{ width: 38, height: 38 }} aria-hidden>{convo.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tv-thread-name">{convo.name}</div>
            <div className="tv-thread-sub">
              <StatusChip status={convo.status} />
              {convo.assignee ? <span style={{ fontSize: 11.5, color: "var(--tv-muted)" }}>Assigned to {convo.assignee}</span> : <span style={{ fontSize: 11.5, color: "var(--tv-muted)" }}>Unassigned</span>}
              {convo.tags.map((t) => <span key={t} className="tv-tagpill">{t}</span>)}
            </div>
          </div>

          <div style={{ position: "relative" }} ref={statusPop.ref}>
            <button type="button" className="tv-statusbtn" onClick={() => statusPop.setOpen(!statusPop.open)} aria-expanded={statusPop.open} aria-haspopup="menu">
              {convo.status} <ChevronDown size={13} />
            </button>
            <Popover open={statusPop.open} onClose={() => statusPop.setOpen(false)} width={190}>
              <div className="tv-pop-label">Conversation status</div>
              {(["Open", "Pending", "Closed"] as const).map((s) => (
                <button key={s} type="button" className="tv-pop-item" onClick={() => setStatus(s)}>
                  {s} {convo.status === s ? <Check size={13} style={{ marginLeft: "auto", color: "var(--tv-primary)" }} /> : null}
                </button>
              ))}
            </Popover>
          </div>

          <div style={{ position: "relative" }} ref={assignPop.ref}>
            <button type="button" className="tv-iconbtn" title="Assign conversation" aria-label="Assign conversation" onClick={() => assignPop.setOpen(!assignPop.open)}>
              <Users size={15} />
            </button>
            <Popover open={assignPop.open} onClose={() => assignPop.setOpen(false)} width={230}>
              <div className="tv-pop-search">
                <Search size={12} style={{ color: "var(--tv-muted)" }} />
                <input placeholder="Search Teammates" value={assignQ} onChange={(e) => setAssignQ(e.target.value)}
                  aria-label="Search teammates" style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%", fontFamily: "var(--tv-font)" }} />
              </div>
              <div className="tv-pop-label">Assign conversation</div>
              <button type="button" className="tv-pop-item" onClick={() => assign(null)}>
                <UserRound size={13} style={{ color: "var(--tv-muted)" }} /> No One
                {!convo.assignee ? <Check size={13} style={{ marginLeft: "auto", color: "var(--tv-primary)" }} /> : null}
              </button>
              {teammates.filter((t) => t.name.toLowerCase().includes(assignQ.toLowerCase())).map((t) => (
                <button key={t.id} type="button" className="tv-pop-item" onClick={() => assign(t.name)}>
                  <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 8.5 }}>{t.initials}</span> {t.name}
                  {convo.assignee === t.name ? <Check size={13} style={{ marginLeft: "auto", color: "var(--tv-primary)" }} /> : null}
                </button>
              ))}
            </Popover>
          </div>

          <div style={{ position: "relative" }} ref={tagPop.ref}>
            <button type="button" className="tv-iconbtn" title="Tag conversation" aria-label="Tag conversation" onClick={() => tagPop.setOpen(!tagPop.open)}>
              <TagIcon size={15} />
            </button>
            <Popover open={tagPop.open} onClose={() => tagPop.setOpen(false)} width={230}>
              <div className="tv-pop-search">
                <Search size={12} style={{ color: "var(--tv-muted)" }} />
                <input placeholder="Search Tags" value={tagQ} onChange={(e) => setTagQ(e.target.value)}
                  aria-label="Search tags" style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%", fontFamily: "var(--tv-font)" }} />
              </div>
              <div className="tv-pop-label">Tag conversation</div>
              {tags.filter((t) => t.name.toLowerCase().includes(tagQ.toLowerCase())).map((t) => (
                <label key={t.id} className="tv-pop-item" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={convo.tags.includes(t.name)} onChange={() => toggleTag(t.name)} style={{ accentColor: "var(--tv-primary)" }} />
                  {t.name}
                </label>
              ))}
              <button type="button" className="tv-pop-item" style={{ color: "var(--tv-primary)", fontWeight: 600 }} onClick={() => { tagPop.setOpen(false); onOpenTagsSettings(); }}>
                Manage tags
              </button>
            </Popover>
          </div>

          <button type="button" className="tv-iconbtn" title="Contact details" aria-label="Open contact details" onClick={onOpenContact}>
            <UserRound size={15} />
          </button>

          <div style={{ position: "relative" }} ref={morePop.ref}>
            <button type="button" className="tv-iconbtn" title="More actions" aria-label={`More actions for ${convo.name}`} onClick={() => morePop.setOpen(!morePop.open)}>
              <MoreHorizontal size={15} />
            </button>
            <Popover open={morePop.open} onClose={() => morePop.setOpen(false)} width={250}>
              <div className="tv-pop-label">Mark conversation</div>
              <button type="button" className="tv-pop-item" onClick={() => { onUpdate({ ...convo, unread: true }); morePop.setOpen(false); }}>
                <EyeOff size={13} style={{ color: "var(--tv-muted)" }} /> Unread
              </button>
              <button type="button" className="tv-pop-item" onClick={() => { onUpdate({ ...convo, unread: false }); morePop.setOpen(false); }}>
                <MailOpen size={13} style={{ color: "var(--tv-muted)" }} /> Read
              </button>
              <div className="tv-pop-label">Downloads</div>
              <button type="button" className="tv-pop-item" onClick={downloadTranscript}>
                <Download size={13} style={{ color: "var(--tv-muted)" }} /> Message Transcript
              </button>
              <div className="tv-pop-label">Conversation filters</div>
              {filterDefs.map(([key, label]) => (
                <div key={key} className="tv-pop-item" style={{ justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <MessageSquare size={13} style={{ color: "var(--tv-muted)" }} /> {label}
                  </span>
                  <button type="button" role="switch" aria-checked={filters[key]} aria-label={`Show ${label}`}
                    className={"tv-switch" + (filters[key] ? " on" : "")}
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))} />
                </div>
              ))}
            </Popover>
          </div>
        </header>

        {downloadMsg ? (
          <div style={{ margin: "10px 16px 0", padding: "7px 12px", borderRadius: 8, background: "var(--tv-green-soft)", border: "1px solid #a7f3d0", color: "var(--tv-green)", fontSize: 12, fontWeight: 600 }}>
            {downloadMsg}
          </div>
        ) : null}

        {convo.appointment ? (
          <div className="tv-appt">
            <CalendarClock size={14} />
            <span><strong>Appointment:</strong>&nbsp;{convo.appointment}</span>
          </div>
        ) : null}

        {convo.unknownReply ? (
          <div className="tv-appt" style={{ color: "var(--tv-red)", background: "var(--tv-red-soft)", borderColor: "#fecaca" }}>
            <MessageSquare size={14} />
            <span><strong>Unknown reply:</strong>&nbsp;this message didn't match an active booking or reminder workflow. Review and reply manually.</span>
          </div>
        ) : null}

        {convo.aiActive ? (
          <div className="tv-ai-banner">
            <div className="tv-ai-banner-txt">
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--tv-primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles size={13} color="var(--tv-primary)" />
              </span>
              <span>AI Agent is handling this conversation <span style={{ fontWeight: 400, color: "var(--tv-muted)" }}>· Booking Assistant</span></span>
            </div>
            <button type="button" className="tv-btn sm" onClick={() => onUpdate({ ...convo, aiActive: false, messages: [...convo.messages, ev("AI session ended — human takeover")] })}>
              Take Over
            </button>
          </div>
        ) : null}

        <div className="tv-msgs">
          {visible.map((m) => <Bubble key={m.id} m={m} convo={convo} />)}
          <div ref={endRef} />
        </div>

        <Composer onSend={send} onNote={note} prefill={prefill} onPrefillApplied={() => setPrefill("")} teammates={teammates} />
      </section>

      <AiAssistPanel
        aiActive={convo.aiActive}
        onUseSuggestion={(t) => setPrefill(t)}
        onTakeover={() => onUpdate({ ...convo, aiActive: false, messages: [...convo.messages, ev("AI session ended — human takeover")] })}
      />
    </div>
  );
}
