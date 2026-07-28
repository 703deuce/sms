"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { conversations as seed, contacts, teamMembers } from "@/lib/mock/data";
import { cn, formatPhone } from "@/lib/utils";
import {
  ChevronDown,
  Filter,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Smile,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

const filters = [
  { label: "All conversations", count: 24 },
  { label: "Mine", count: 8 },
  { label: "Unassigned", count: 4 },
  { label: "Unread", count: 12 },
  { label: "Open", count: 18 },
  { label: "Pending", count: 2 },
  { label: "Closed", count: 6 },
  { label: "Snoozed", count: 1 },
  { label: "Spam", count: 0 },
];

const tags = [
  { label: "hot-lead", count: 6 },
  { label: "estimate", count: 8 },
  { label: "appointment", count: 10 },
];

const avatarByName: Record<string, string> = {
  "Maya Chen": "/avatars/maya.svg",
  "Luis Ortiz": "/avatars/luis.svg",
  "Priya Shah": "/avatars/priya.svg",
  "James Wilson": "/avatars/james.svg",
};

const timeByName: Record<string, string> = {
  "Maya Chen": "4:42 PM",
  "Luis Ortiz": "2:10 PM",
  "Priya Shah": "7:20 PM",
  "James Wilson": "Yesterday",
};

export function InboxView({ initialFilter = "All conversations" }: { initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState(seed[0]?.id);
  const [reply, setReply] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [items, setItems] = useState(seed);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (filter === "Mine") return c.assignedTo === "Jordan Lee" || c.assignedTo === "Alex Rivera";
      if (filter === "Unassigned") return !c.assignedTo;
      if (filter === "Unread") return c.unread;
      if (filter === "Open") return c.status === "Open";
      if (filter === "Pending") return c.status === "Pending";
      if (filter === "Closed") return c.status === "Closed";
      if (filter === "Snoozed") return c.status === "Snoozed";
      if (filter === "Spam") return c.status === "Spam";
      return true;
    });
  }, [filter, items]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? items[0];
  const contact = contacts.find((c) => c.id === selected?.contactId);

  function sendReply() {
    if (!selected || !reply.trim()) return;
    setItems((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              lastMessage: reply.trim(),
              unread: false,
              messages: [
                ...c.messages,
                {
                  id: `local_${Date.now()}`,
                  direction: composerTab === "note" ? ("note" as const) : ("out" as const),
                  body: reply.trim(),
                  at: new Date().toISOString(),
                  user: composerTab === "note" ? "Alex Rivera" : undefined,
                },
              ],
            }
          : c,
      ),
    );
    setReply("");
  }

  return (
    <div className="surface grid h-[calc(100vh-7.5rem)] min-h-[620px] overflow-hidden rounded-[12px] lg:grid-cols-[200px_280px_minmax(0,1fr)_260px]">
      {/* Filters */}
      <aside className="hidden border-r border-border p-3 lg:block">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-[10px] border border-border bg-card pl-8 pr-2 text-[12px] outline-none focus:border-primary"
              placeholder="Search conversations..."
            />
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border hover:bg-muted"
            aria-label="Filters"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(f.label)}
              className={cn(
                "flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-[12px] font-medium transition",
                filter === f.label
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span>{f.label}</span>
              <span className="text-[11px] tabular-nums opacity-80">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tags</p>
            <button type="button" className="rounded-md p-1 hover:bg-muted" aria-label="Add tag">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {tags.map((t) => (
              <button
                key={t.label}
                type="button"
                className="flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rotate-45 bg-violet-400" />
                  {t.label}
                </span>
                <span className="text-[11px]">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Conversation list */}
      <aside className="border-r border-border">
        <div className="space-y-1 p-2">
          {filtered.map((c) => {
            const active = c.id === selected?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full gap-2.5 rounded-[12px] px-2.5 py-2.5 text-left transition",
                  active ? "bg-sky-50" : "hover:bg-muted/60",
                )}
              >
                <span className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarByName[c.contactName] ?? "/avatars/alex.svg"}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                      c.status === "Pending" ? "bg-amber-400" : c.status === "Closed" ? "bg-slate-400" : "bg-emerald-500",
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{c.contactName}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeByName[c.contactName] ?? "Today"}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {c.lastMessage}
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2">
                    <StatusChip status={c.status} />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {c.assignedTo ?? "Unassigned"}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-bold">{selected.contactName}</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[12px] text-muted-foreground">{formatPhone(selected.phone)}</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="h-9 rounded-[10px] border border-border bg-card px-2 text-[12px]">
                  <option>Assign…</option>
                  {teamMembers.map((m) => (
                    <option key={m.id}>{m.name}</option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-[10px] border border-border bg-card px-2 text-[12px]"
                  defaultValue={selected.status}
                >
                  <option>Open</option>
                  <option>Pending</option>
                  <option>Closed</option>
                </select>
                <button type="button" className="rounded-[10px] border border-border p-2 hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {selected.messages.map((m) => {
                if (m.direction === "note") {
                  return (
                    <div
                      key={m.id}
                      className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-950"
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
                  <div key={m.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-[14px] px-3.5 py-2.5 text-[13px]",
                        outbound
                          ? "bg-primary text-white"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {outbound ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                          Harbor Home
                        </p>
                      ) : null}
                      <p>{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", outbound ? "text-white/70" : "text-muted-foreground")}>
                        {new Date(m.at).toLocaleString(undefined, {
                          month: "numeric",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {outbound ? " · ✓✓" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-3">
              <div className="mb-2 flex gap-4 border-b border-border px-1">
                <button
                  type="button"
                  onClick={() => setComposerTab("reply")}
                  className={cn(
                    "-mb-px border-b-2 pb-2 text-[13px] font-semibold",
                    composerTab === "reply"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground",
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
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  Internal note
                </button>
              </div>
              <textarea
                className="min-h-[88px] w-full resize-none rounded-[12px] border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
                placeholder={composerTab === "note" ? "Write an internal note..." : "Write a reply..."}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button className="h-9 rounded-[10px]" onClick={sendReply}>
                  Send
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" className="h-9 rounded-[10px]" type="button">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI suggestion
                </Button>
                <Button variant="outline" className="h-9 rounded-[10px]" type="button">
                  Saved replies
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-[10px]" type="button">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-[10px]" type="button">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
            Select a conversation
          </div>
        )}
      </section>

      {/* Contact details */}
      <aside className="hidden border-l border-border p-4 xl:block">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Contact details
        </p>
        {contact ? (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarByName[contact.firstName + " " + contact.lastName] ?? "/avatars/maya.svg"}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
            <p className="mt-3 text-[15px] font-bold">
              {contact.firstName} {contact.lastName}
            </p>
            <p className="text-[12px] text-muted-foreground">{contact.email}</p>
            <div className="mt-3">
              <StatusChip status={contact.status} />
            </div>
            <dl className="mt-4 space-y-3 text-[12px]">
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="mt-0.5 font-medium">{contact.consentSource}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lists</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {contact.lists.map((l) => (
                    <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {l}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opt-out</dt>
                <dd className="mt-0.5 font-medium">No</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Added</dt>
                <dd className="mt-0.5 font-medium">
                  {contact.consentDate
                    ? new Date(contact.consentDate).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last message</dt>
                <dd className="mt-0.5 font-medium">Today at 4:42 PM</dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-muted-foreground">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
                  >
                    {t}
                  </span>
                ))}
                <button
                  type="button"
                  className="rounded-full border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12px] text-muted-foreground">No contact selected</p>
        )}
      </aside>
    </div>
  );
}
