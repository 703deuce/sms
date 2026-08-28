"use client";

import { InboxContactDrawer } from "@/components/inbox/inbox-contact-drawer";
import { TemplatePicker } from "@/components/inbox/template-picker";
import { MediaPicker, AttachedMediaThumbs } from "@/components/messaging/media-picker";
import { Button } from "@/components/ui/button";
import type { Contact, Conversation, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  Code2,
  Filter,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  Paperclip,
  PenSquare,
  Search,
  Smile,
  Tag,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InboxFilter =
  | "my:all"
  | "my:unread"
  | "my:open"
  | "my:pending"
  | "my:snoozed"
  | "all:all"
  | "all:unassigned"
  | "all:unread"
  | "all:open"
  | "all:pending"
  | "all:closed"
  | "all:spam"
  | `tag:${string}`
  | `teammate:${string}`;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function InboxView({
  initialFilter = "all:all",
  conversations: seed,
  contacts,
  teamMembers,
  currentUserName,
  currentUserId,
}: {
  initialFilter?: string;
  conversations: Conversation[];
  contacts: Contact[];
  teamMembers: User[];
  currentUserName?: string;
  currentUserId?: string;
}) {
  const mapInitialFilter = (): InboxFilter => {
    switch (initialFilter) {
      case "Mine":
        return "my:all";
      case "Unassigned":
        return "all:unassigned";
      case "Unread":
        return "all:unread";
      case "Open":
        return "all:open";
      case "Pending":
        return "all:pending";
      case "Closed":
        return "all:closed";
      default:
        return "my:all";
    }
  };

  const [filter, setFilter] = useState<InboxFilter>(mapInitialFilter());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(seed[0]?.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reply, setReply] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [items, setItems] = useState(seed);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expandedGroups, setExpandedGroups] = useState({
    my: true,
    all: true,
    tags: true,
    teammates: true,
  });

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of items) {
      for (const t of c.tags || []) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [items]);

  const counts = useMemo(() => {
    const mine = items.filter((c) => c.assignedTo === currentUserName);
    return {
      myAll: mine.length,
      myUnread: mine.filter((c) => c.unread).length,
      myOpen: mine.filter((c) => c.status === "Open").length,
      myPending: mine.filter((c) => c.status === "Pending").length,
      mySnoozed: mine.filter((c) => c.status === "Snoozed").length,
      allAll: items.length,
      allUnassigned: items.filter((c) => !c.assignedTo).length,
      allUnread: items.filter((c) => c.unread).length,
      allOpen: items.filter((c) => c.status === "Open").length,
      allPending: items.filter((c) => c.status === "Pending").length,
      allClosed: items.filter((c) => c.status === "Closed").length,
      allSpam: items.filter((c) => c.status === "Spam").length,
    };
  }, [items, currentUserName]);

  const filtered = useMemo(() => {
    let rows = items;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          c.contactName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      );
    }

    const [scope, key] = filter.split(":") as [string, string];
    if (scope === "my") {
      rows = rows.filter((c) => c.assignedTo === currentUserName);
      if (key === "unread") rows = rows.filter((c) => c.unread);
      if (key === "open") rows = rows.filter((c) => c.status === "Open");
      if (key === "pending") rows = rows.filter((c) => c.status === "Pending");
      if (key === "snoozed") rows = rows.filter((c) => c.status === "Snoozed");
    } else if (scope === "all") {
      if (key === "unassigned") rows = rows.filter((c) => !c.assignedTo);
      if (key === "unread") rows = rows.filter((c) => c.unread);
      if (key === "open") rows = rows.filter((c) => c.status === "Open");
      if (key === "pending") rows = rows.filter((c) => c.status === "Pending");
      if (key === "closed") rows = rows.filter((c) => c.status === "Closed");
      if (key === "spam") rows = rows.filter((c) => c.status === "Spam");
    } else if (scope === "tag") {
      rows = rows.filter((c) => c.tags?.includes(key));
    } else if (scope === "teammate") {
      const member = teamMembers.find((m) => m.id === key);
      if (member) rows = rows.filter((c) => c.assignedTo === member.name);
    }

    rows = [...rows].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });
    return rows;
  }, [items, filter, search, currentUserName, teamMembers, sortOrder]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? items[0];
  const contact = contacts.find((c) => c.id === selected?.contactId);
  const bulkMode = selectedIds.size > 0;

  useEffect(() => {
    setMediaUrls([]);
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/inbox/${selectedId}`)
      .then((res) => res.json())
      .then((json: { data?: Conversation }) => {
        if (cancelled || !json.data) return;
        setItems((prev) => prev.map((c) => (c.id === selectedId ? json.data! : c)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (statusRef.current && !statusRef.current.contains(t)) setStatusMenuOpen(false);
      if (assignRef.current && !assignRef.current.contains(t)) setAssignMenuOpen(false);
      if (tagRef.current && !tagRef.current.contains(t)) setTagMenuOpen(false);
      if (moreRef.current && !moreRef.current.contains(t)) setMoreMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: composerTab === "note" ? "note" : "reply",
          body: reply.trim(),
          mediaUrls: composerTab === "reply" && mediaUrls.length ? mediaUrls : undefined,
        }),
      });
      const json = (await res.json()) as { data?: Conversation; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to send");
      if (json.data) {
        setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
      }
      setReply("");
      setMediaUrls([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setStatusMenuOpen(false);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as { data?: Conversation };
    if (res.ok && json.data) {
      setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
    }
  }

  async function assignTo(assigneeId: string) {
    if (!selected) return;
    setAssignMenuOpen(false);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    });
    const json = (await res.json()) as { data?: Conversation };
    if (res.ok && json.data) {
      setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
    }
  }

  async function markUnread() {
    if (!selected) return;
    setMoreMenuOpen(false);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: true }),
    });
    const json = (await res.json()) as { data?: Conversation };
    if (res.ok && json.data) {
      setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
    }
  }

  function downloadTranscript() {
    if (!selected) return;
    setMoreMenuOpen(false);
    const lines = (selected.messages || []).map((m) => {
      const who = m.direction === "in" ? selected.contactName : m.user || "You";
      const when = new Date(m.at).toLocaleString();
      return `[${when}] ${who}: ${m.body}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.contactName.replace(/\s+/g, "-")}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function updateTags(tags: string[]) {
    if (!selected) return;
    setTagMenuOpen(false);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    const json = (await res.json()) as { data?: Conversation };
    if (res.ok && json.data) {
      setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = (key: keyof typeof expandedGroups) => {
    setExpandedGroups((g) => ({ ...g, [key]: !g[key] }));
  };

  const filterBtn = (id: InboxFilter, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setFilter(id);
        setSelectedIds(new Set());
      }}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition",
        filter === id
          ? "bg-[#eef2ff] font-semibold text-[#6366f1]"
          : "text-[#374151] hover:bg-[#f9fafb]",
      )}
    >
      <span>{label}</span>
      <span className="text-[12px] tabular-nums text-[#9ca3af]">{count}</span>
    </button>
  );

  return (
    <div className="-mx-0 flex h-[calc(100vh-3.5rem)] min-h-[640px] overflow-hidden border-y border-[#e5e7eb] bg-white">
      {/* Filter rail */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[#e5e7eb] bg-[#fafafa] lg:flex">
        <div className="border-b border-[#e5e7eb] px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#111827]">Inbox</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[#059669]"
            >
              <span className="h-2 w-2 rounded-full bg-[#059669]" />
              Online
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-8 pr-2 text-[12px] outline-none focus:border-[#6366f1]"
              />
            </div>
            <Link
              href="/send/quick"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6366f1] hover:bg-[#eef2ff]"
              title="New message"
            >
              <PenSquare className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <FilterGroup
            title="My Conversations"
            open={expandedGroups.my}
            onToggle={() => toggleGroup("my")}
          >
            {filterBtn("my:all", "All", counts.myAll)}
            {filterBtn("my:unread", "Unread", counts.myUnread)}
            {filterBtn("my:open", "Open", counts.myOpen)}
            {filterBtn("my:pending", "Pending", counts.myPending)}
            {filterBtn("my:snoozed", "Snoozed", counts.mySnoozed)}
          </FilterGroup>

          <FilterGroup
            title="All Conversations"
            open={expandedGroups.all}
            onToggle={() => toggleGroup("all")}
          >
            {filterBtn("all:all", "All", counts.allAll)}
            {filterBtn("all:unassigned", "Unassigned", counts.allUnassigned)}
            {filterBtn("all:unread", "Unread", counts.allUnread)}
            {filterBtn("all:open", "Open", counts.allOpen)}
            {filterBtn("all:pending", "Pending", counts.allPending)}
            {filterBtn("all:closed", "Closed", counts.allClosed)}
            {filterBtn("all:spam", "Spam", counts.allSpam)}
          </FilterGroup>

          <FilterGroup
            title="Tagged Conversations"
            open={expandedGroups.tags}
            onToggle={() => toggleGroup("tags")}
          >
            {tagCounts.length === 0 ? (
              <p className="px-2.5 py-1 text-[12px] text-[#9ca3af]">No tags yet</p>
            ) : (
              tagCounts.map((t) =>
                filterBtn(`tag:${t.label}` as InboxFilter, t.label, t.count),
              )
            )}
            <Link
              href="/settings"
              className="mt-1 block px-2.5 text-[12px] font-medium text-[#6366f1] hover:underline"
            >
              + Manage Tags
            </Link>
          </FilterGroup>

          <FilterGroup
            title="Teammates"
            open={expandedGroups.teammates}
            onToggle={() => toggleGroup("teammates")}
          >
            {teamMembers.slice(0, 5).map((m) => {
              const count = items.filter((c) => c.assignedTo === m.name).length;
              return filterBtn(`teammate:${m.id}` as InboxFilter, m.name, count);
            })}
          </FilterGroup>
        </div>
      </aside>

      {/* Conversation list */}
      <aside
        className={cn(
          "flex w-full max-w-[320px] shrink-0 flex-col border-r border-[#e5e7eb] bg-white sm:max-w-[300px]",
          selectedId ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[#f3f4f6] px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[#d1d5db]"
            checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
            onChange={(e) => {
              if (e.target.checked) setSelectedIds(new Set(filtered.map((c) => c.id)));
              else setSelectedIds(new Set());
            }}
          />
          <select className="h-8 flex-1 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]">
            <option>All</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
            className="h-8 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e7eb] hover:bg-[#f9fafb]"
          >
            <Filter className="h-3.5 w-3.5 text-[#6b7280]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-[#6b7280]">No conversations in this view</p>
          ) : (
            filtered.map((c) => {
              const active = !bulkMode && c.id === selected?.id;
              const checked = selectedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "relative flex w-full gap-2.5 border-b border-[#f9fafb] px-3 py-3 text-left transition",
                    active && "bg-[#eef2ff]",
                    checked && "bg-[#f5f3ff]",
                    !active && !checked && "hover:bg-[#fafafa]",
                  )}
                >
                  {active ? (
                    <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#6366f1]" />
                  ) : null}
                  <input
                    type="checkbox"
                    className="mt-2 h-4 w-4 shrink-0 rounded border-[#d1d5db]"
                    checked={checked}
                    onChange={() => toggleSelect(c.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 gap-2.5 text-left"
                    onClick={() => {
                      if (bulkMode) toggleSelect(c.id);
                      else setSelectedId(c.id);
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">
                      {initials(c.contactName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-[#111827]">
                          {c.contactName}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#9ca3af]">
                          {relativeTime(c.updatedAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-[#6b7280]">
                        {c.lastMessage}
                      </span>
                      {c.unread ? (
                        <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#6366f1]" />
                      ) : null}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col bg-white",
          selectedId ? "flex" : "hidden md:flex",
        )}
      >
        {bulkMode ? (
          <BulkActionsBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onSetStatus={(status) => {
              void Promise.all(
                [...selectedIds].map((id) =>
                  fetch(`/api/inbox/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                  }),
                ),
              ).then(() => window.location.reload());
            }}
          />
        ) : selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] md:hidden"
                  onClick={() => setSelectedId(undefined)}
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">
                    {initials(selected.contactName)}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-[#111827]">{selected.contactName}</p>
                    {selected.tags?.[0] ? (
                      <span className="mt-0.5 inline-flex rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#6366f1]">
                        {selected.tags[0]}
                      </span>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div ref={statusRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12px] font-semibold text-[#059669]"
                  >
                    {selected.status}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {statusMenuOpen ? (
                    <MenuPanel title="Conversation Status">
                      {["Open", "Pending", "Closed"].map((s) => (
                        <MenuItem key={s} onClick={() => void updateStatus(s)}>
                          {s}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  ) : null}
                </div>

                <div ref={assignRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAssignMenuOpen((v) => !v)}
                    className="inline-flex h-8 max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12px] text-[#374151]"
                  >
                    <UserCircle2 className="h-4 w-4 shrink-0 text-[#9ca3af]" />
                    <span className="truncate">
                      {selected.assignedTo ? `Assigned to ${selected.assignedTo}` : "Unassigned"}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  </button>
                  {assignMenuOpen ? (
                    <MenuPanel title="Assign To">
                      <MenuItem onClick={() => void assignTo("")}>No One</MenuItem>
                      {currentUserId ? (
                        <MenuItem onClick={() => void assignTo(currentUserId)}>Me</MenuItem>
                      ) : null}
                      {teamMembers.map((m) => (
                        <MenuItem key={m.id} onClick={() => void assignTo(m.id)}>
                          {m.name}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  ) : null}
                </div>

                <div ref={tagRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setTagMenuOpen((v) => !v)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
                    title="Tags"
                  >
                    <Tag className="h-4 w-4 text-[#6b7280]" />
                    {selected.tags?.length ? (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#6366f1] text-[9px] font-bold text-white">
                        {selected.tags.length}
                      </span>
                    ) : null}
                  </button>
                  {tagMenuOpen ? (
                    <MenuPanel title="Tags">
                      {tagCounts.map((t) => {
                        const active = selected.tags?.includes(t.label);
                        return (
                          <label
                            key={t.label}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#f9fafb]"
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => {
                                const next = active
                                  ? (selected.tags || []).filter((x) => x !== t.label)
                                  : [...(selected.tags || []), t.label];
                                void updateTags(next);
                              }}
                            />
                            {t.label}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        className="w-full border-t border-[#f3f4f6] px-3 py-2 text-[12px] font-semibold text-[#6366f1]"
                        onClick={() => setTagMenuOpen(false)}
                      >
                        Set Tags
                      </button>
                    </MenuPanel>
                  ) : null}
                </div>

                <div ref={moreRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
                  >
                    <MoreHorizontal className="h-4 w-4 text-[#6b7280]" />
                  </button>
                  {moreMenuOpen ? (
                    <MenuPanel>
                      <MenuItem onClick={() => void markUnread()}>Mark unread</MenuItem>
                      <MenuItem onClick={downloadTranscript}>Download transcript</MenuItem>
                    </MenuPanel>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setContactDrawerOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                  title="Contact details"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#fafafa] px-5 py-4">
              <ThreadTimeline conversation={selected} currentUserName={currentUserName} />
            </div>

            <div className="border-t border-[#e5e7eb] bg-white px-4 py-3">
              <div className="mb-2 flex gap-6 border-b border-[#f3f4f6]">
                <ComposerTab
                  active={composerTab === "reply"}
                  onClick={() => setComposerTab("reply")}
                  label="Message"
                />
                <ComposerTab
                  active={composerTab === "note"}
                  onClick={() => setComposerTab("note")}
                  label="Note"
                />
              </div>
              {mediaUrls.length > 0 ? (
                <AttachedMediaThumbs
                  urls={mediaUrls}
                  onRemove={(url) => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                />
              ) : null}
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  composerTab === "note"
                    ? "Add an internal note…"
                    : "Type a message…"
                }
                className="min-h-[72px] w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-[13px] outline-none focus:border-[#6366f1]"
              />
              {error ? <p className="mt-1 text-[12px] text-[#dc2626]">{error}</p> : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  {composerTab === "reply" ? (
                    <>
                      <IconBtn icon={Paperclip} onClick={() => setShowMedia(true)} />
                      <IconBtn icon={Smile} />
                      <IconBtn icon={ImageIcon} />
                      <IconBtn icon={Code2} onClick={() => setShowTemplates(true)} />
                      <IconBtn icon={Bookmark} />
                    </>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#9ca3af]">
                    {reply.length} / 918
                  </span>
                  <Button
                    className="h-9 rounded-lg bg-[#6366f1] px-4 text-[13px] hover:bg-[#4f46e5]"
                    onClick={() => void sendReply()}
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? "Sending…" : "Send"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyThread />
        )}
      </section>

      <InboxContactDrawer
        open={contactDrawerOpen}
        onClose={() => setContactDrawerOpen(false)}
        contact={contact}
        conversation={selected}
      />
      <TemplatePicker
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={(body) => {
          setReply(body);
          setComposerTab("reply");
        }}
      />
      <MediaPicker
        open={showMedia}
        onClose={() => setShowMedia(false)}
        initialSelected={mediaUrls}
        onConfirm={setMediaUrls}
      />
    </div>
  );
}

function FilterGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="mb-1 flex w-full items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]"
      >
        {title}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? <div className="space-y-0.5">{children}</div> : null}
    </div>
  );
}

function ThreadTimeline({
  conversation,
  currentUserName,
}: {
  conversation: Conversation;
  currentUserName?: string;
}) {
  const messages = conversation.messages || [];
  let lastDate = "";

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const dateKey = new Date(m.at).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const showDate = dateKey !== lastDate;
        if (showDate) lastDate = dateKey;

        if (m.direction === "note") {
          return (
            <div key={m.id}>
              {showDate ? <DateSeparator label={dateKey} /> : null}
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#92400e]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#b45309]">
                  Note from {m.user ?? currentUserName ?? "Team"}{" "}
                  <span className="font-normal normal-case text-[#d97706]">[Internal]</span>
                </p>
                <p className="mt-1">{m.body}</p>
                <p className="mt-1 text-[11px] text-[#d97706]">
                  {new Date(m.at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        }

        const outbound = m.direction === "out";
        return (
          <div key={m.id}>
            {showDate ? <DateSeparator label={dateKey} /> : null}
            <div className={cn("flex gap-2", outbound ? "justify-end" : "justify-start")}>
              {!outbound ? (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[10px] font-bold text-[#6366f1]">
                  {initials(conversation.contactName)}
                </span>
              ) : null}
              <div className={cn("max-w-[70%]", outbound && "text-right")}>
                <p className="mb-1 text-[11px] text-[#9ca3af]">
                  {outbound ? currentUserName ?? "You" : conversation.contactName} ·{" "}
                  {new Date(m.at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <div
                  className={cn(
                    "inline-block rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    outbound
                      ? "rounded-br-md bg-[#6366f1] text-white"
                      : "rounded-bl-md border border-[#e5e7eb] bg-white text-[#111827]",
                  )}
                >
                  {m.body}
                </div>
                {outbound ? (
                  <p className="mt-1 text-[10px] text-[#9ca3af]">✓✓</p>
                ) : null}
              </div>
              {outbound ? (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-[10px] font-bold text-white">
                  {(currentUserName || "Y").slice(0, 2).toUpperCase()}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <p className="py-2 text-center text-[11px] font-medium text-[#9ca3af]">{label}</p>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-[18px] font-semibold text-[#111827]">No Conversation Selected</p>
      <p className="mt-2 max-w-sm text-[14px] text-[#6b7280]">
        Select a conversation to begin chatting.
      </p>
      <Link
        href="/send/quick"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#6366f1] px-5 text-[14px] font-semibold text-white hover:bg-[#4f46e5]"
      >
        New Message
      </Link>
    </div>
  );
}

function BulkActionsBar({
  count,
  onClear,
  onSetStatus,
}: {
  count: number;
  onClear: () => void;
  onSetStatus: (status: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <p className="text-[20px] font-bold text-[#111827]">{count} Conversations Selected</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => onSetStatus("Open")}>
          Set Open
        </Button>
        <Button variant="outline" onClick={() => onSetStatus("Pending")}>
          Set Pending
        </Button>
        <Button variant="outline" onClick={() => onSetStatus("Closed")}>
          Close
        </Button>
        <Button variant="ghost" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}

function ComposerTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 pb-2 text-[13px] font-semibold transition",
        active
          ? "border-[#6366f1] text-[#6366f1]"
          : "border-transparent text-[#6b7280] hover:text-[#111827]",
      )}
    >
      {label}
    </button>
  );
}

function IconBtn({
  icon: Icon,
  onClick,
}: {
  icon: typeof Paperclip;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MenuPanel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
      {title ? (
        <p className="border-b border-[#f3f4f6] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#f9fafb]"
    >
      {children}
    </button>
  );
}
