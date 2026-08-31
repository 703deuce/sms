/**
 * Kimi session 2026-08-31T00-27-03-004Z-da00ac — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import React, { useMemo, useState } from "react";
import InboxRail, { FilterSel } from "./components/InboxRail";
import ConversationList from "./components/ConversationList";
import ThreadView from "./components/ThreadView";
import ContactPanel from "./components/ContactPanel";
import BulkActionsBar from "./components/BulkActionsBar";
import TagsSettings from "./components/TagsSettings";
import SettingsHome from "./components/SettingsHome";
import InboxSettings from "./components/InboxSettings";
import { CONVERSATIONS, TAGS as INIT_TAGS, Conversation, Tag, TEAMMATES } from "./mock-data";
import { MessageSquarePlus, MessagesSquare, X } from "lucide-react";

type View = "inbox" | "settings" | "inboxSettings" | "tags";

export default function ConversationsFlow() {
  const [convos, setConvos] = useState<Conversation[]>(CONVERSATIONS);
  const [tags, setTags] = useState<Tag[]>(INIT_TAGS);
  const [sel, setSel] = useState<FilterSel>({ kind: "mine", key: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [view, setView] = useState<View>("inbox");

  const counts = useMemo(() => {
    const mine = convos.filter((c) => c.assignee === "me");
    const c: Record<string, number> = {
      mineAll: mine.length, mineUnread: mine.filter((x) => x.unread).length,
      mineOpen: mine.filter((x) => x.status === "open").length, minePending: mine.filter((x) => x.status === "pending").length,
      allAll: convos.length, unassigned: convos.filter((x) => !x.assignee).length,
      allUnread: convos.filter((x) => x.unread).length, allOpen: convos.filter((x) => x.status === "open").length,
      allPending: convos.filter((x) => x.status === "pending").length, closed: convos.filter((x) => x.status === "closed").length,
    };
    tags.forEach((t) => {
      const tagged = convos.filter((x) => x.tags.includes(t.id));
      c["tag:" + t.id] = tagged.length;
      ["all", "open", "pending", "closed"].forEach((s) => {
        c["tag:" + t.id + ":" + s] = s === "all" ? tagged.length : tagged.filter((x) => x.status === s).length;
      });
    });
    TEAMMATES.forEach((t) => {
      const owned = convos.filter((x) => x.assignee === t.id);
      c["tm:" + t.id] = owned.length;
      ["all", "open", "pending"].forEach((s) => {
        c["tm:" + t.id + ":" + s] = s === "all" ? owned.length : owned.filter((x) => x.status === s).length;
      });
    });
    return c;
  }, [convos, tags]);

  const filtered = useMemo(() => convos.filter((c) => {
    if (sel.kind === "mine") {
      if (c.assignee !== "me") return false;
      if (sel.key === "unread") return !!c.unread;
      if (sel.key === "open" || sel.key === "pending") return c.status === sel.key;
      return true;
    }
    if (sel.kind === "all") {
      if (sel.key === "unassigned") return !c.assignee;
      if (sel.key === "unread") return !!c.unread;
      if (sel.key === "all") return true;
      return c.status === sel.key;
    }
    if (sel.kind === "tag") {
      if (!c.tags.includes(sel.key)) return false;
      return sel.sub ? c.status === sel.sub : true;
    }
    if (c.assignee !== sel.key) return false;
    return sel.sub ? c.status === sel.sub : true;
  }), [convos, sel]);

  const title = sel.kind === "mine" ? "Me" : sel.kind === "all" ? "Everyone"
    : sel.kind === "tag" ? tags.find((t) => t.id === sel.key)?.name ?? "Tag"
    : TEAMMATES.find((t) => t.id === sel.key)?.name ?? "Teammate";
  const subtitle = sel.kind === "mine" && sel.key === "unread" ? "Unread Conversations"
    : sel.sub ? sel.sub[0].toUpperCase() + sel.sub.slice(1) + " Conversations"
    : sel.kind === "mine" || sel.kind === "all" ? (sel.key === "all" ? "All Conversations" : sel.key[0].toUpperCase() + sel.key.slice(1) + " Conversations")
    : "All Conversations";

  const selected = convos.find((c) => c.id === selectedId) ?? null;
  const update = (c: Conversation) => setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...c, unread: selectedId === c.id ? false : c.unread } : x)));

  const toggleCheck = (id: string, v: boolean) => setChecked((prev) => { const n = new Set(prev); v ? n.add(id) : n.delete(id); return n; });
  const checkAll = (v: boolean) => setChecked(v ? new Set(filtered.map((c) => c.id)) : new Set());

  const bulk = (action: string) => {
    const [kind, val] = action.split(":");
    setConvos((prev) => prev.map((c) => {
      if (!checked.has(c.id)) return c;
      if (kind === "status") return { ...c, status: val as Conversation["status"], assignee: val === "closed" ? null : c.assignee };
      if (kind === "assign") return { ...c, assignee: val || null };
      if (kind === "tag") return { ...c, tags: val === "clear" ? [] : Array.from(new Set([...c.tags, val])) };
      if (kind === "mark") return { ...c, unread: val === "unread" };
      return c;
    }));
    setChecked(new Set());
  };

  const pickConvo = (c: Conversation) => {
    setSelectedId(c.id);
    if (c.unread) setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: false } : x)));
  };

  return (
    <div className="ref-scope">
      {view === "settings" ? (
        <SettingsHome onOpenInbox={() => setView("inboxSettings")} />
      ) : view === "inboxSettings" ? (
        <InboxSettings onBack={() => setView("settings")} onOpenTags={() => setView("tags")} />
      ) : view === "tags" ? (
        <TagsSettings tags={tags} onBack={() => setView("inboxSettings")}
          onCreate={(t) => setTags((p) => [{ ...t, id: "t" + Date.now(), created: "Aug 27th, 2024 @ 4:25 pm" }, ...p])} />
      ) : (
        <>
          <InboxRail sel={sel} onSel={(s) => { setSel(s); setSelectedId(null); setChecked(new Set()); }} counts={counts} tags={tags} onNew={() => setNewMsgOpen(true)} />
          <ConversationList title={title} subtitle={subtitle} convos={filtered} selectedId={selectedId}
            onSelect={pickConvo} checked={checked} onCheck={toggleCheck}
            allChecked={filtered.length > 0 && filtered.every((c) => checked.has(c.id))} onCheckAll={checkAll} />
          {checked.size > 0 ? (
            <BulkActionsBar count={checked.size} onAction={bulk} />
          ) : selected ? (
            <>
              <ThreadView convo={selected} onUpdate={update} contactOpen={contactOpen}
                onToggleContact={() => setContactOpen(!contactOpen)} onOpenTagsSettings={() => setView("tags")} />
              {contactOpen && <ContactPanel convo={selected} onClose={() => setContactOpen(false)} />}
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#fbfcfd" }}>
              <MessagesSquare size={52} color="#c7d2fe" strokeWidth={1.4} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>No Conversation Selected</div>
                <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Select a conversation to begin chatting.</div>
              </div>
              <button className="tv-btn" onClick={() => setNewMsgOpen(true)}><MessageSquarePlus size={14} /> New Message</button>
              <button onClick={() => setView("tags")} style={{ background: "none", border: "none", fontSize: 12, color: "var(--tv-primary)", cursor: "pointer", marginTop: 8 }}>Manage inbox tags →</button>
            </div>
          )}
        </>
      )}

      {newMsgOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120, zIndex: 100 }} onClick={() => setNewMsgOpen(false)}>
          <div className="ref-pop" style={{ background: "#fff", borderRadius: 12, width: 460, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Compose New Message</span>
              <X size={16} color="#9ca3af" style={{ cursor: "pointer" }} onClick={() => setNewMsgOpen(false)} />
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>To:</label>
            <input className="tv-input" placeholder="Search or create new contact" style={{ margin: "6px 0 10px" }} autoFocus />
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 14px" }}>
              Search contacts by name or number. Provide a new number to create a contact.
            </p>
            <textarea className="tv-input" rows={3} placeholder="Type a message" style={{ resize: "none" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="tv-btn-ghost" onClick={() => setNewMsgOpen(false)}>Cancel</button>
              <button className="tv-btn" onClick={() => setNewMsgOpen(false)}>Send ▸</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
