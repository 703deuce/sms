"use client";

import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { AiReplyStatusToggle } from "@/components/ai-replies/ai-reply-ui";
import { V1EmptyState, V1PageHeader } from "@/components/v1/v1-polish";
import { Button } from "@/components/ui/button";
import { aiReplyTypeLabel, type AiReplyRecord } from "@/lib/ai-replies/types";
import { cn, formatNumber, formatPhone } from "@/lib/utils";
import { Bot, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

  return (
    <div className="mx-auto max-w-[1200px] px-1 pb-10">
      <V1PageHeader
        emoji="🤖"
        title="AI Agents"
        description="Let AI handle incoming texts with your knowledge, tone, and handoff rules — like a smart teammate that never sleeps."
        actions={
          <Link
            href="/ai-replies/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create agent
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { emoji: "🟢", label: "Active agents", value: activeCount },
          { emoji: "💬", label: "Total agents", value: rows.length },
          {
            emoji: "📨",
            label: "Messages sent",
            value: formatNumber(rows.reduce((s, r) => s + (r.messagesSent || 0), 0)),
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[14px] border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[12px] text-muted-foreground">
              {stat.emoji} {stat.label}
            </p>
            <p className="mt-1 text-[22px] font-bold tabular-nums text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(["all", "active", "paused"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-semibold capitalize",
                  statusFilter === f ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <V1EmptyState
              emoji="🤖"
              title="No AI agents yet"
              description="Create your first agent to answer FAQs, qualify leads, and hand off to humans when needed."
              action={
                <Link href="/ai-replies/new">
                  <Button>Create your first agent</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-violet-50 text-[18px]">
                    {row.replyType === "conversational" ? "💬" : "✨"}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/ai-replies/${row.id}`}
                      className="text-[15px] font-semibold text-foreground no-underline hover:text-indigo-600"
                    >
                      {row.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {aiReplyTypeLabel(row.replyType)} ·{" "}
                      {row.phoneNumberE164 ? formatPhone(row.phoneNumberE164) : "No number assigned"} ·{" "}
                      {formatNumber(row.messagesSent)} sent
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Created {formatRelativeDate(row.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      row.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.status === "active" ? "🟢 Active" : "⏸ Paused"}
                  </span>
                  <AiReplyStatusToggle
                    active={row.status === "active"}
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-[12px] border border-dashed border-border bg-muted/20 px-4 py-3 text-[12px] text-muted-foreground">
        <Bot className="h-4 w-4 shrink-0 text-indigo-600" />
        <span>
          <span className="font-semibold text-foreground">Tip:</span> Use conversational agents for back-and-forth
          support; single-prompt agents work great for simple FAQs.
        </span>
      </div>
    </div>
  );
}
