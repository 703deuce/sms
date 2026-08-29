"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import {
  MockupListToolbar,
  MockupTablePagination,
} from "@/components/automate/mockup-automate-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  autoReplyTriggerLabel,
  type AutoReplyRecord,
} from "@/lib/auto-replies/types";
import { formatNumber } from "@/lib/utils";
import { Filter, Plus, Reply } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function AutoRepliesList({ initialRows }: { initialRows: AutoReplyRecord[] }) {
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
        row.message.toLowerCase().includes(q) ||
        autoReplyTriggerLabel(row.triggerType, row.triggerConfig).toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function patchRow(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/auto-replies/${id}`, {
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
    if (!confirm("Delete this auto reply?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/auto-replies/${id}`, { method: "DELETE" });
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
        breadcrumb="Automate / Auto Replies"
        title="Auto Replies"
        description="Manage your automated responses based on incoming keywords or events."
        icon={Reply}
        actions={
          <Link
            href="/auto-replies/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Auto Reply
          </Link>
        }
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <MockupListToolbar
          searchPlaceholder="Search by name..."
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
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === "active" ? "bg-primary text-white" : "text-slate-600"
                }`}
              >
                Active Only
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
            icon={<Reply className="h-8 w-8" />}
            title="No auto replies yet"
            description="Create a simple one-message response for list joins, new contacts, forms, and more."
            actionLabel="Create Auto Reply"
            actionHref="/auto-replies/new"
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Name</TH>
                  <TH>Trigger</TH>
                  <TH>Message Type</TH>
                  <TH>Stats</TH>
                  <TH>Updated</TH>
                  <TH>Status</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((row) => (
                  <TR key={row.id} className="border-slate-100">
                    <TD>
                      <Link
                        href={`/auto-replies/${row.id}`}
                        className="font-semibold text-slate-900 no-underline hover:text-primary"
                      >
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="text-slate-600">
                      {autoReplyTriggerLabel(row.triggerType, row.triggerConfig)}
                    </TD>
                    <TD className="text-slate-600">{row.mediaUrls?.length ? "MMS" : "SMS"}</TD>
                    <TD className="text-slate-600">
                      <span className="font-medium text-slate-900">{formatNumber(row.sendCount)}</span>
                      <span className="text-slate-400"> sent</span>
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(row.updatedAt)}
                    </TD>
                    <TD>
                      <AutoReplyStatusToggle
                        active={row.status === "active"}
                        disabled={busyId === row.id}
                        onChange={(next) =>
                          void patchRow(row.id, {
                            status: next ? "active" : "paused",
                          })
                        }
                      />
                    </TD>
                    <TD>
                      <RowActionsMenu
                        actions={[
                          {
                            label: "View",
                            icon: "users",
                            href: `/auto-replies/${row.id}`,
                          },
                          {
                            label: "Edit",
                            icon: "pencil",
                            href: `/auto-replies/${row.id}/edit`,
                          },
                          {
                            label: "Duplicate",
                            icon: "copy",
                            onClick: () => void patchRow(row.id, { action: "duplicate" }),
                          },
                          {
                            label: row.status === "active" ? "Pause" : "Activate",
                            icon: "pencil",
                            onClick: () => void patchRow(row.id, { action: "toggle_status" }),
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
