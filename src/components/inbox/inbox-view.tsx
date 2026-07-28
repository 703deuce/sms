"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { conversations as seed, contacts, teamMembers } from "@/lib/mock/data";
import { cn, formatPhone } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const filters = [
  "All conversations",
  "Mine",
  "Unassigned",
  "Unread",
  "Open",
  "Pending",
  "Closed",
  "Snoozed",
  "Spam",
];

export function InboxView({ initialFilter = "All conversations" }: { initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState(seed[0]?.id);
  const [reply, setReply] = useState("");
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
                  direction: "out" as const,
                  body: reply.trim(),
                  at: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
    setReply("");
  }

  return (
    <div className="surface grid h-[calc(100vh-8.5rem)] min-h-[560px] overflow-hidden rounded-xl lg:grid-cols-[200px_280px_1fr]">
      <aside className="hidden border-r border-border p-3 lg:block">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2 text-xs outline-none focus:border-primary"
            placeholder="Search"
          />
        </div>
        <div className="space-y-0.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "w-full rounded-md px-2.5 py-1.5 text-left text-sm",
                filter === f ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="mt-4 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tags
        </p>
        <div className="mt-1 space-y-0.5 px-2 text-sm text-muted-foreground">
          <p>hot-lead</p>
          <p>estimate</p>
          <p>appointment</p>
        </div>
      </aside>

      <section className="border-r border-border overflow-y-auto">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground lg:hidden">
          Filter: {filter}
        </div>
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={cn(
              "w-full border-b border-border px-3 py-3 text-left transition hover:bg-muted/50",
              selected?.id === c.id && "bg-muted/70",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {c.contactName}
                {c.unread ? (
                  <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.lastMessage}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusChip status={c.status} />
              <span className="text-[10px] text-muted-foreground">
                {c.assignedTo ?? "Unassigned"}
              </span>
            </div>
          </button>
        ))}
      </section>

      <section className="flex min-w-0 flex-col">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <p className="font-medium">{selected.contactName}</p>
                <p className="text-xs text-muted-foreground">{formatPhone(selected.phone)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="h-8 rounded-md border border-border bg-card px-2 text-xs">
                  <option>Assign…</option>
                  {teamMembers.map((m) => (
                    <option key={m.id}>{m.name}</option>
                  ))}
                </select>
                <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" defaultValue={selected.status}>
                  <option>Open</option>
                  <option>Pending</option>
                  <option>Closed</option>
                  <option>Snoozed</option>
                </select>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_240px]">
              <div className="flex min-h-0 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                        m.direction === "out" && "ml-auto bg-primary text-primary-foreground",
                        m.direction === "in" && "bg-muted",
                        m.direction === "note" && "mx-auto border border-dashed border-amber-300 bg-amber-50 text-amber-950",
                      )}
                    >
                      {m.direction === "note" ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase">Internal note · {m.user}</p>
                      ) : null}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.direction === "out" ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {new Date(m.at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-3">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={sendReply}>
                      Send
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReply("Thanks for reaching out—happy to help.")}>
                      AI suggestion
                    </Button>
                    <Button size="sm" variant="ghost">
                      Saved replies
                    </Button>
                    <Button size="sm" variant="ghost">
                      Attach
                    </Button>
                    <Button size="sm" variant="ghost">
                      Internal note
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="hidden overflow-y-auto border-l border-border p-4 text-sm lg:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contact details
                </p>
                <p className="mt-2 font-medium">{selected.contactName}</p>
                <p className="text-muted-foreground">{contact?.email || "No email"}</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consent</span>
                    <StatusChip status={contact?.status || "Subscribed"} />
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Source</span>
                    <span>{contact?.consentSource}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Lists</span>
                    <span className="text-right">{contact?.lists.join(", ")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Opt-out</span>
                    <span>{contact?.status === "Unsubscribed" ? "Yes" : "No"}</span>
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No conversations in this filter
          </div>
        )}
      </section>
    </div>
  );
}
