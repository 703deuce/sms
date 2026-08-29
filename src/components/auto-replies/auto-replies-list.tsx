"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickTableToolbar,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  autoReplyTriggerLabel,
  type AutoReplyRecord,
} from "@/lib/auto-replies/types";
import { cn } from "@/lib/utils";
import { Filter, Plus, Reply } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AutoRepliesList({ initialRows }: { initialRows: AutoReplyRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);

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
        title="Auto Replies"
        description="Send one predefined message when a simple event happens."
        icon={Reply}
        actions={
          <Link
            href="/auto-replies/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Auto Reply
          </Link>
        }
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          searchPlaceholder="Search auto replies"
          filterSlot={
            <Button variant="outline" size="sm" className="h-10 gap-2 border-slate-200">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<MessageSquareReply className="h-8 w-8" />}
            title="No auto replies yet"
            description="Create a simple one-message response for list joins, new contacts, forms, and more."
            actionLabel="New Auto Reply"
            actionHref="/auto-replies/new"
          />
        ) : (
          <Table className="text-[13px]">
            <THead>
              <TR className="border-slate-200">
                <TH>Name</TH>
                <TH>Trigger</TH>
                <TH>Message</TH>
                <TH>Status</TH>
                <TH>Last updated</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className="border-slate-100">
                  <TD className="font-semibold text-slate-900">{row.name}</TD>
                  <TD className="text-slate-600">
                    {autoReplyTriggerLabel(row.triggerType, row.triggerConfig)}
                  </TD>
                  <TD className="max-w-xs truncate text-slate-500">{row.message}</TD>
                  <TD>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void patchRow(row.id, { action: "toggle_status" })}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                        row.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {row.status === "active" ? "Active" : "Paused"}
                    </button>
                  </TD>
                  <TD className="whitespace-nowrap text-slate-500">
                    {formatSlickDateTime(row.updatedAt)}
                  </TD>
                  <TD>
                    <RowActionsMenu
                      actions={[
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
        )}
      </Card>
    </div>
  );
}
