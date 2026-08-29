"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickTableToolbar,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { AiReplyStatusToggle } from "@/components/ai-replies/ai-reply-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { aiReplyTypeLabel, type AiReplyRecord } from "@/lib/ai-replies/types";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Filter, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function conversionRate(row: AiReplyRecord): number {
  if (!row.contactsEngaged) return 0;
  return ((row.contactsEngaged - row.handoffs) / row.contactsEngaged) * 100;
}

export function AiRepliesList({ initialRows }: { initialRows: AiReplyRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);

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
        breadcrumb="Automate / AI Replies"
        title="AI Replies"
        description="Manage your AI-powered auto-replies for incoming messages."
        icon={Sparkles}
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          searchPlaceholder="Search AI replies..."
          createSlot={
            <Link
              href="/ai-replies/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create AI Reply
            </Link>
          }
          filterSlot={
            <Button variant="outline" size="sm" className="h-10 gap-2 border-slate-200">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No AI replies yet"
            description="Let AI respond conversationally to incoming texts with your knowledge and handoff rules."
            actionLabel="Create AI Reply"
            actionHref="/ai-replies/new"
          />
        ) : (
          <Table className="text-[13px]">
            <THead>
              <TR className="border-slate-200">
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Active</TH>
                <TH>Sent</TH>
                <TH>Conversions</TH>
                <TH>Conversion Rate</TH>
                <TH>Created</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
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
                  <TD>
                    <AiReplyStatusToggle
                      active={row.status === "active"}
                      disabled={busyId === row.id}
                      onChange={(next) =>
                        void patchRow(row.id, { status: next ? "active" : "paused" })
                      }
                    />
                  </TD>
                  <TD className="text-slate-600">{formatNumber(row.messagesSent)}</TD>
                  <TD className="text-slate-600">{formatNumber(row.conversions)}</TD>
                  <TD className="text-slate-600">{formatPercent(conversionRate(row) / 100)}</TD>
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
        )}
      </Card>
    </div>
  );
}
