"use client";

import React, { useCallback, useMemo, useState } from "react";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import "./reference.css";
import { CONVERSATIONS, TAGS, TEAMMATES, type Conversation, type Tag } from "./mock-data";
import { InboxRail, type RailFilter } from "./components/InboxRail";
import { ConversationList } from "./components/ConversationList";
import { ThreadView } from "./components/ThreadView";
import { ContactDrawer } from "./components/ContactDrawer";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { TagsSettings } from "./components/TagsSettings";
import { InboxSettings } from "./components/InboxSettings";
import { NewMessageModal } from "./components/NewMessageModal";

type View = "inbox" | "tags" | "settings";

export default function ReferencePage() {
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [tags, setTags] = useState<Tag[]>(TAGS);
  const [filter, setFilter] = useState<RailFilter>({ kind: "mine", status: "All" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("inbox");
  const [contactOpen, setContactOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading] = useState(false);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  const updateConvo = useCallback((next: Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }, []);

  const onSelect = (c: Conversation) => {
    setSelectedId(c.id);
    setChecked(new Set());
    if (c.unread) updateConvo({ ...c, unread: false });
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleIds = useMemo(() => conversations.map((c) => c.id), [conversations]);

  const toggleCheckAll = () => {
    setChecked((prev) => (prev.size >= visibleIds.length ? new Set() : new Set(visibleIds)));
  };

  const bulkAction = (action: string) => {
    const [kind, value] = action.split(":");
    setConversations((prev) =>
      prev.map((c) => {
        if (!checked.has(c.id)) return c;
        if (kind === "status") {
          const status = (value[0].toUpperCase() + value.slice(1)) as Conversation["status"];
          let nextTags = c.tags;
          if (status === "Closed") {
            const untag = tags.filter((t) => t.untagOnClose).map((t) => t.name);
            nextTags = c.tags.filter((t) => !untag.includes(t));
          }
          return { ...c, status, tags: nextTags };
        }
        if (kind === "assign") {
          const mate = TEAMMATES.find((t) => t.id === value);
          return { ...c, assignee: mate ? mate.name : null };
        }
        if (kind === "tag") {
          if (value === "clear") return { ...c, tags: [] };
          const tag = tags.find((t) => t.id === value);
          if (tag && !c.tags.includes(tag.name)) return { ...c, tags: [...c.tags, tag.name] };
          return c;
        }
        if (kind === "mark") return { ...c, unread: value === "unread" };
        return c;
      }),
    );
    setChecked(new Set());
  };

  const startNewMessage = (convo: Conversation, text: string) => {
    let target = conversations.find((c) => c.id === convo.id);
    if (!target) {
      target = { ...convo, preview: text, messages: [] };
      setConversations((prev) => [target!, ...prev]);
    }
    updateConvo({
      ...target,
      preview: text,
      messages: [...target.messages, { id: Math.random().toString(36).slice(2), kind: "outbound", body: text, time: "now", sender: "Me" }],
    });
    setSelectedId(target.id);
    setNewMsgOpen(false);
  };

  if (view === "tags") {
    return (
      <div className="kimi-conversations" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--tv-bg)" }}>
        <TagsSettings tags={tags} onChange={setTags} onBack={() => setView("inbox")} />
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="kimi-conversations" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--tv-bg)" }}>
        <InboxSettings onBack={() => setView("inbox")} />
      </div>
    );
  }

  const mobileThreadOpen = Boolean(selected && checked.size === 0);

  return (
    <div className={"kimi-conversations tv-layout" + (mobileThreadOpen ? " tv-thread-open" : "")} style={{ display: "flex", height: "100vh", background: "var(--tv-surface)", overflow: "hidden" }}>
      <InboxRail
        conversations={conversations}
        tags={tags}
        teammates={TEAMMATES}
        filter={filter}
        onFilter={(f) => { setFilter(f); setSelectedId(null); setChecked(new Set()); }}
        onNew={() => setNewMsgOpen(true)}
        onOpenSettings={() => setView("settings")}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <ConversationList
        conversations={conversations}
        filter={filter}
        selectedId={selectedId}
        selected={checked}
        onSelect={onSelect}
        onToggleSelect={toggleCheck}
        onToggleSelectAll={toggleCheckAll}
        loading={loading}
        searchQuery={searchQuery}
      />

      <main style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
        {checked.size > 0 ? (
          <BulkActionsBar count={checked.size} tags={tags} teammates={TEAMMATES} onAction={bulkAction} onClear={() => setChecked(new Set())} />
        ) : selected ? (
          <>
            <ThreadView
              convo={selected}
              tags={tags}
              teammates={TEAMMATES}
              onUpdate={updateConvo}
              onOpenContact={() => setContactOpen(true)}
              onOpenTagsSettings={() => setView("tags")}
              onBack={() => setSelectedId(null)}
            />
            {contactOpen ? <ContactDrawer convo={selected} onClose={() => setContactOpen(false)} /> : null}
          </>
        ) : conversations.length === 0 ? (
          <div className="tv-empty">
            <div className="tv-empty-icon"><MessagesSquare size={24} /></div>
            <p style={{ fontSize: 15, fontWeight: 700 }}>No conversations yet</p>
            <p style={{ fontSize: 12.5, color: "var(--tv-muted)", maxWidth: 340 }}>
              Conversations appear here when customers reply to appointment reminders or you start a new message.
            </p>
            <button type="button" className="tv-btn primary" style={{ marginTop: 8 }} onClick={() => setNewMsgOpen(true)}>
              <MessageSquarePlus size={14} /> New Message
            </button>
          </div>
        ) : (
          <div className="tv-empty">
            <div className="tv-empty-icon"><MessagesSquare size={24} /></div>
            <p style={{ fontSize: 15, fontWeight: 700 }}>No Conversation Selected</p>
            <p style={{ fontSize: 12.5, color: "var(--tv-muted)" }}>Select a conversation to begin chatting.</p>
            <button type="button" className="tv-btn primary" style={{ marginTop: 8 }} onClick={() => setNewMsgOpen(true)}>
              <MessageSquarePlus size={14} /> New Message
            </button>
          </div>
        )}
      </main>

      {newMsgOpen ? (
        <NewMessageModal conversations={conversations} onClose={() => setNewMsgOpen(false)} onStart={startNewMessage} />
      ) : null}
    </div>
  );
}
