"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { AiReplyStatusToggle } from "@/components/ai-replies/ai-reply-ui";
import {
  MockupListToolbar,
  MockupTablePagination,
} from "@/components/automate/mockup-automate-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { aiReplyTypeLabel, type AiReplyRecord } from "@/lib/ai-replies/types";
import { formatNumber, formatPhone } from "@/lib/utils";
import { Filter, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function AiRepliesList({ initialRows }: { initialRows: AiReplyRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && row.status !== "active") return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        aiReplyTypeLabel(row.replyType).toLowerCase().includes(q) ||
        (row.phoneNumberE164 || "").includes(q)
      );
    });
  }, [rows, search, statusFilter]);

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
    if (!confirm("Delete this AI reply?")) return;
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
    <div className="text-[13px]">
      <SlickAudienceHeader
        breadcrumb="Automate / AI Agents"
        title="AI Agents"
        description="Manage your AI-powered auto-replies for incoming messages."
        icon={Sparkles}
        actions={
          <Link
            href="/ai-replies/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </Link>
        }
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <MockupListToolbar
          searchPlaceholder="Search agents..."
          searchValue={search}
          onSearchChange={setSearch}
          filterSlot={
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === "all" ? "bg-primary text-white" : "text-slate-600"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === "active" ? "bg-primary text-white" : "text-slate-600"
                }`}
              >
                Active
              </button>
            </div>
          }
          createSlot={
            <Button variant="outline" size="sm" className="hidden h-10 gap-2 border-slate-200 sm:inline-flex">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No AI agents yet"
            description="Let AI respond conversationally to incoming texts with your knowledge and handoff rules."
            actionLabel="Create Agent"
            actionHref="/ai-replies/new"
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH>Inbox</TH>
                  <TH>Sent</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((row) => (
                  <TR key={row.id} className="border-slate-100">
                    <TD>
                      <Link
                        href={`/ai-replies/${row.id}`}
                        className="font-semibold text-slate-900 no-underline hover:text-primary"
                      >
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="text-slate-600">{aiReplyTypeLabel(row.replyType)}</TD>
                    <TD className="text-slate-600">
                      {row.phoneNumberE164 ? formatPhone(row.phoneNumberE164) : "—"}
                    </TD>
                    <TD className="text-slate-600">{formatNumber(row.messagesSent)}</TD>
                    <TD>
                      <AiReplyStatusToggle
                        active={row.status === "active"}
                        disabled={busyId === row.id}
                        onChange={(next) =>
                          void patchRow(row.id, { status: next ? "active" : "paused" })
                        }
                      />
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(row.createdAt)}
                    </TD>
                    <TD>
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
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <MockupTablePagination total={filtered.length} />
          </>
        )}
      </Card>
    </div>
  );
}
