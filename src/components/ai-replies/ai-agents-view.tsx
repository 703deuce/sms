"use client";

import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { AiReplyStatusToggle } from "@/components/ai-replies/ai-reply-ui";
import { V1EmptyState, V1PageHeader } from "@/components/v1/v1-polish";
import { Button } from "@/components/ui/button";
import { aiReplyTypeLabel, type AiReplyRecord } from "@/lib/ai-replies/types";
import { cn, formatNumber, formatPhone } from "@/lib/utils";
import { Bot, Lightbulb, MessageSquareText, Plus, Search, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
] as const;

function MetaDot() {
  return (
    <span
      aria-hidden
      className="mx-2 inline-block h-[3px] w-[3px] rounded-full bg-border align-middle"
    />
  );
}

export function AiAgentsView({ initialRows }: { initialRows: AiReplyRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && row.status !== "active") return false;
      if (statusFilter === "paused" && row.status === "active") return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        aiReplyTypeLabel(row.replyType).toLowerCase().includes(q) ||
        (row.phoneNumberE164 || "").includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const activeCount = rows.filter((r) => r.status === "active").length;
  const totalSent = rows.reduce((s, r) => s + (r.messagesSent || 0), 0);

  async function patchRow(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ai-replies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setRows((prev) => prev.map((r) => (r.id === id ? json.data : r)));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this AI agent?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/ai-replies/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    {
      label: "Active agents",
      value: activeCount,
      icon: Bot,
      tone: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100",
    },
    {
      label: "Total agents",
      value: rows.length,
      icon: Sparkles,
      tone: "bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100",
    },
    {
      label: "Messages sent",
      value: formatNumber(totalSent),
      icon: Send,
      tone: "bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100",
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-1 pb-12">
      <V1PageHeader
        emoji="🤖"
        title="AI Agents"
        description="Let AI handle incoming texts with your knowledge, tone, and handoff rules — like a smart teammate that never sleeps."
        actions={
          <Link href="/ai-replies/new" className="no-underline">
            <Button size="lg" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create agent
            </Button>
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 shadow-sm transition-all duration-150 hover:shadow-md"
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                stat.tone,
              )}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-[22px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-visible rounded-xl border border-border bg-card shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              aria-label="Search agents"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex items-center gap-0.5 self-start rounded-lg border border-border/60 bg-muted/70 p-0.5 sm:self-auto"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === f.id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <V1EmptyState
              emoji="🤖"
              title={rows.length === 0 ? "No AI agents yet" : "No agents match your filters"}
              description={
                rows.length === 0
                  ? "Create your first agent to answer FAQs, qualify leads, and hand off to humans when needed."
                  : "Try adjusting your search or status filter."
              }
              action={
                rows.length === 0 ? (
                  <Link href="/ai-replies/new">
                    <Button>Create your first agent</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {filtered.map((row) => {
              const isActive = row.status === "active";
              return (
                <li
                  key={row.id}
                  className={cn(
                    "group flex items-start justify-between gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/30 sm:items-center",
                    busyId === row.id && "opacity-60",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset transition-colors",
                        isActive
                          ? "bg-indigo-50 text-indigo-600 ring-indigo-100"
                          : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {row.replyType === "conversational" ? (
                        <MessageSquareText className="h-[18px] w-[18px]" />
                      ) : (
                        <Sparkles className="h-[18px] w-[18px]" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/ai-replies/${row.id}`}
                          className="truncate text-[14px] font-semibold text-foreground no-underline transition-colors hover:text-primary"
                        >
                          {row.name}
                        </Link>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            isActive
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
                              : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isActive ? "bg-emerald-500" : "bg-slate-400",
                            )}
                          />
                          {isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 flex min-w-0 items-center truncate text-[12px] text-muted-foreground">
                        <span className="font-medium text-foreground/70">
                          {aiReplyTypeLabel(row.replyType)}
                        </span>
                        <MetaDot />
                        {row.phoneNumberE164 ? (
                          <span className="tabular-nums">{formatPhone(row.phoneNumberE164)}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">No number assigned</span>
                        )}
                        <MetaDot />
                        <span className="tabular-nums">{formatNumber(row.messagesSent)} sent</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Created {formatRelativeDate(row.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pt-1 sm:pt-0">
                    <AiReplyStatusToggle
                      active={isActive}
                      disabled={busyId === row.id}
                      onChange={(next) => void patchRow(row.id, { status: next ? "active" : "paused" })}
                    />
                    <RowActionsMenu
                      actions={[
                        { label: "View", icon: "users", href: `/ai-replies/${row.id}` },
                        { label: "Edit", icon: "pencil", href: `/ai-replies/${row.id}/edit` },
                        {
                          label: "Duplicate",
                          icon: "copy",
                          onClick: () => void patchRow(row.id, { action: "duplicate" }),
                        },
                        {
                          label: "Delete",
                          icon: "trash",
                          destructive: true,
                          onClick: () => void removeRow(row.id),
                        },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
          <Lightbulb className="mt-px h-4 w-4 shrink-0 text-primary" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> Use conversational
            agents for back-and-forth support; single-prompt agents work great for simple
            FAQs and one-off replies.
          </p>
        </div>
      ) : null}
    </div>
  );
}
