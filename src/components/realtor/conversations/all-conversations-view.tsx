"use client";

import type { Contact, Conversation, ConversationChannel, User } from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";
import {
  ChevronDown,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Search,
  Send,
  Smile,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ConversationTab =
  | "all"
  | "mine"
  | "unassigned"
  | "unread"
  | "calls"
  | "sms"
  | "email";

const TAB_DEFS: Array<{ id: ConversationTab; label: string }> = [
  { id: "all", label: "All Conversations" },
  { id: "mine", label: "Assigned to me" },
  { id: "unassigned", label: "Unassigned" },
  { id: "unread", label: "Unread" },
  { id: "calls", label: "Calls" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
];

function channelOf(c: Conversation): ConversationChannel {
  return c.channel || "sms";
}

function matchesTab(
  c: Conversation,
  tab: ConversationTab,
  currentUserName?: string,
): boolean {
  switch (tab) {
    case "mine":
      return Boolean(currentUserName && c.assignedTo === currentUserName);
    case "unassigned":
      return !c.assignedTo;
    case "unread":
      return c.unread;
    case "calls":
      return channelOf(c) === "call";
    case "sms":
      return channelOf(c) === "sms";
    case "email":
      return channelOf(c) === "email";
    default:
      return true;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ChannelIcon({ channel }: { channel: ConversationChannel }) {
  if (channel === "call") return <Phone className="h-3.5 w-3.5 text-[#6b7280]" />;
  if (channel === "email") return <Mail className="h-3.5 w-3.5 text-[#6b7280]" />;
  return <MessageSquare className="h-3.5 w-3.5 text-[#6b7280]" />;
}

export function AllConversationsView({
  conversations: seed,
  contacts,
  teamMembers,
  currentUserName,
  currentUserId,
  initialTab = "all",
}: {
  conversations: Conversation[];
  contacts: Contact[];
  teamMembers: User[];
  currentUserName?: string;
  currentUserId?: string;
  initialTab?: ConversationTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ConversationTab>(initialTab);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [items, setItems] = useState(seed);
  const [selectedId, setSelectedId] = useState(seed[0]?.id);
  const [reply, setReply] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(seed);
  }, [seed]);

  useEffect(() => {
    const contactId = searchParams.get("contact") || searchParams.get("contactId");
    const conversationId = searchParams.get("conversation");
    if (conversationId) {
      const match = items.find((c) => c.id === conversationId);
      if (match) setSelectedId(match.id);
      return;
    }
    if (contactId) {
      const match = items.find((c) => c.contactId === contactId);
      if (match) setSelectedId(match.id);
    }
  }, [searchParams, items]);

  const selectTab = useCallback(
    (next: ConversationTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<ConversationTab, number> = {
      all: items.length,
      mine: 0,
      unassigned: 0,
      unread: 0,
      calls: 0,
      sms: 0,
      email: 0,
    };
    for (const c of items) {
      if (matchesTab(c, "mine", currentUserName)) counts.mine += 1;
      if (matchesTab(c, "unassigned", currentUserName)) counts.unassigned += 1;
      if (matchesTab(c, "unread", currentUserName)) counts.unread += 1;
      if (matchesTab(c, "calls", currentUserName)) counts.calls += 1;
      if (matchesTab(c, "sms", currentUserName)) counts.sms += 1;
      if (matchesTab(c, "email", currentUserName)) counts.email += 1;
    }
    return counts;
  }, [items, currentUserName]);

  const agentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const c of items) {
      if (c.assignedTo) names.add(c.assignedTo);
    }
    for (const m of teamMembers) names.add(m.name);
    return Array.from(names).sort();
  }, [items, teamMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((c) => matchesTab(c, tab, currentUserName));

    if (typeFilter !== "all") {
      rows = rows.filter((c) => channelOf(c) === typeFilter);
    }
    if (stateFilter !== "all") {
      rows = rows.filter((c) => c.status.toLowerCase() === stateFilter);
    }
    if (agentFilter !== "all") {
      rows = rows.filter((c) => c.assignedTo === agentFilter);
    }
    if (q) {
      rows = rows.filter(
        (c) =>
          c.contactName.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q) ||
          c.phone.includes(q),
      );
    }

    rows = [...rows].sort((a, b) => {
      const at = new Date(a.updatedAt).getTime();
      const bt = new Date(b.updatedAt).getTime();
      return sort === "newest" ? bt - at : at - bt;
    });

    return rows;
  }, [items, tab, currentUserName, search, typeFilter, stateFilter, agentFilter, sort]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? items[0];
  const contact = contacts.find((c) => c.id === selected?.contactId);
  const isFixture = selected?.id.startsWith("conv-fixture-");

  const sendReply = useCallback(async () => {
    if (!selected || !reply.trim() || sending || isFixture) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: composerTab === "note" ? "note" : "reply",
          body: reply.trim(),
        }),
      });
      const json = (await res.json()) as { data?: Conversation; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to send");
      if (json.data) {
        setItems((prev) => prev.map((c) => (c.id === selected.id ? json.data! : c)));
      }
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [selected, reply, sending, isFixture, composerTab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">All Conversations</h1>
        <p className="mt-1 text-[15px] text-[#6b7280]">
          View and manage all your conversations within other CRM contacts.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
        {TAB_DEFS.map((t) => {
          const active = tab === t.id;
          const count = tabCounts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "mb-[-1px] flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
                active
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {t.label}
              {["all", "mine", "unassigned", "unread"].includes(t.id) ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    active ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#f3f4f6] text-[#6b7280]",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="realtor-card grid min-h-[640px] overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* Conversation list */}
        <aside className="flex flex-col border-r border-[#e5e7eb]">
          <div className="space-y-2 border-b border-[#e5e7eb] p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#e5e7eb] px-2 text-[12px] text-[#374151]"
              >
                <option value="all">All types</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="call">Calls</option>
              </select>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#e5e7eb] px-2 text-[12px] text-[#374151]"
              >
                <option value="all">All states</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#e5e7eb] px-2 text-[12px] text-[#374151]"
              >
                <option value="all">All agents</option>
                {agentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                className="h-8 rounded-lg border border-[#e5e7eb] px-2 text-[12px] text-[#374151]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-[#6b7280]">No conversations match these filters.</p>
            ) : null}
            {filtered.map((c) => {
              const active = c.id === selected?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "mb-1 flex w-full gap-3 rounded-lg px-3 py-3 text-left transition",
                    active ? "bg-[#eff6ff] ring-1 ring-[#bfdbfe]" : "hover:bg-[#f9fafb]",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[11px] font-bold text-[#2563eb]">
                    {c.contactName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-[#111827]">{c.contactName}</span>
                      <span className="shrink-0 text-[11px] text-[#9ca3af]">{relativeTime(c.updatedAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <ChannelIcon channel={channelOf(c)} />
                      <span className="truncate text-[12px] text-[#6b7280]">{c.lastMessage}</span>
                    </span>
                  </span>
                  {c.unread ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-w-0 flex-col border-r border-[#e5e7eb]">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eff6ff] text-[12px] font-bold text-[#2563eb]">
                    {selected.contactName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-[#111827]">{selected.contactName}</p>
                    <p className="text-[12px] text-[#6b7280]">Active {relativeTime(selected.updatedAt)}</p>
                  </div>
                </div>
                <button type="button" className="rounded-lg p-2 hover:bg-[#f9fafb]" aria-label="More">
                  <MoreHorizontal className="h-4 w-4 text-[#6b7280]" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e5e7eb]" />
                  <span className="text-[11px] font-medium text-[#9ca3af]">Today</span>
                  <div className="h-px flex-1 bg-[#e5e7eb]" />
                </div>
                {selected.messages.map((m) => {
                  if (m.direction === "note") {
                    return (
                      <div
                        key={m.id}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Internal note · {m.user ?? "Team"}
                        </p>
                        <p className="mt-1">{m.body}</p>
                      </div>
                    );
                  }
                  const outbound = m.direction === "out";
                  return (
                    <div key={m.id} className={cn("flex gap-2", outbound ? "justify-end" : "justify-start")}>
                      {!outbound ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[10px] font-bold text-[#2563eb]">
                          {selected.contactName[0]}
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px]",
                          outbound ? "bg-[#2563eb] text-white" : "bg-[#f3f4f6] text-[#111827]",
                        )}
                      >
                        {!outbound ? (
                          <p className="mb-1 text-[11px] font-semibold text-[#374151]">{selected.contactName}</p>
                        ) : null}
                        <p>{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#e5e7eb] p-3">
                <div className="mb-2 flex gap-4 border-b border-[#e5e7eb] px-1">
                  <button
                    type="button"
                    onClick={() => setComposerTab("reply")}
                    className={cn(
                      "-mb-px border-b-2 pb-2 text-[13px] font-semibold",
                      composerTab === "reply"
                        ? "border-[#2563eb] text-[#2563eb]"
                        : "border-transparent text-[#6b7280]",
                    )}
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerTab("note")}
                    className={cn(
                      "-mb-px border-b-2 pb-2 text-[13px] font-semibold",
                      composerTab === "note"
                        ? "border-[#2563eb] text-[#2563eb]"
                        : "border-transparent text-[#6b7280]",
                    )}
                  >
                    Note
                  </button>
                </div>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your message..."
                  className="min-h-[80px] w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]"
                />
                {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
                {isFixture ? (
                  <p className="mt-2 text-[12px] text-[#6b7280]">Demo conversation — replies are disabled.</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#6b7280]">
                    <button type="button" className="rounded p-1.5 hover:bg-[#f9fafb]" aria-label="Emoji">
                      <Smile className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1.5 hover:bg-[#f9fafb]" aria-label="Attach">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || isFixture || !reply.trim()}
                    className="realtor-btn-primary h-9"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "Sending…" : "Send"}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-[#6b7280]">
              Select a conversation
            </div>
          )}
        </section>

        {/* Contact details */}
        <aside className="overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[#111827]">Contact Details</h3>
            <button type="button" className="text-[#2563eb] hover:underline" aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff] text-[18px] font-bold text-[#2563eb]">
                  {selected.contactName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <p className="mt-3 text-[16px] font-bold text-[#111827]">{selected.contactName}</p>
              </div>

              <dl className="space-y-3 text-[13px]">
                <div className="flex items-center gap-2 text-[#374151]">
                  <Phone className="h-4 w-4 text-[#9ca3af]" />
                  {formatPhone(selected.phone)}
                </div>
                {selected.email || contact?.email ? (
                  <div className="flex items-center gap-2 text-[#374151]">
                    <Mail className="h-4 w-4 text-[#9ca3af]" />
                    {selected.email || contact?.email}
                  </div>
                ) : null}
                {selected.location ? (
                  <div className="text-[#374151]">{selected.location}</div>
                ) : null}
              </dl>

              <div className="border-t border-[#e5e7eb] pt-4">
                <dl className="space-y-3 text-[13px]">
                  {[
                    ["Lead Type", selected.leadType || "—"],
                    ["Lead Stage", selected.leadStage || selected.status],
                    ["Owner", selected.assignedTo || "Unassigned"],
                    ["Source", selected.source || contact?.consentSource || "—"],
                    [
                      "Created",
                      contact?.dateAdded
                        ? new Date(contact.dateAdded).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—",
                    ],
                    ["Last Activity", relativeTime(selected.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-[#6b7280]">{label}</dt>
                      <dd className="text-right font-medium text-[#111827]">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={`/realtor/leads/${selected.contactId}`} className="mt-3 block text-[13px] font-semibold text-[#2563eb]">
                  view full history &gt;
                </Link>
              </div>

              <div className="border-t border-[#e5e7eb] pt-4">
                <h4 className="text-[13px] font-bold text-[#111827]">Conversation Info</h4>
                <dl className="mt-3 space-y-3 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-[#6b7280]">Channel</dt>
                    <dd className="font-medium capitalize text-[#111827]">{channelOf(selected)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6b7280]">Status</dt>
                    <dd>
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                        {selected.status}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6b7280]">Messages</dt>
                    <dd className="font-medium text-[#111827]">{selected.messages.length}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[#6b7280]">No contact selected</p>
          )}
        </aside>
      </div>
    </div>
  );
}
