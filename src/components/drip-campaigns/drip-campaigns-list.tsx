"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickTableToolbar,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { DripStatusToggle } from "@/components/drip-campaigns/drip-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  dripTriggerLabel,
  type DripCampaignRecord,
} from "@/lib/drip-campaigns/types";
import { Filter, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DripCampaignsList({ initialRows }: { initialRows: DripCampaignRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patchRow(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drip-campaigns/${id}`, {
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
    if (!confirm("Delete this drip campaign?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/drip-campaigns/${id}`, { method: "DELETE" });
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
        breadcrumb="Campaigns / Drip Campaigns"
        title="Drip Campaigns"
        description="Send a timed series of messages when someone triggers an event."
        icon={Layers}
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          searchPlaceholder="Search campaigns..."
          createSlot={
            <Link
              href="/drip-campaigns/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Drip Campaign
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
            icon={<Layers className="h-8 w-8" />}
            title="No drip campaigns yet"
            description="Build a multi-message sequence that starts when a contact joins a list, gets a tag, and more."
            actionLabel="Create Drip Campaign"
            actionHref="/drip-campaigns/new"
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>Name</TH>
                  <TH>Triggered by</TH>
                  <TH>Active</TH>
                  <TH>Last Sent</TH>
                  <TH>Created At</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id} className="border-slate-100">
                    <TD>
                      <Link
                        href={`/drip-campaigns/${row.id}`}
                        className="font-semibold text-slate-900 no-underline hover:text-primary"
                      >
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="text-slate-600">
                      {dripTriggerLabel(row.triggerType, row.triggerConfig)}
                    </TD>
                    <TD>
                      <DripStatusToggle
                        active={row.status === "active"}
                        disabled={busyId === row.id}
                        onChange={(next) =>
                          void patchRow(row.id, {
                            status: next ? "active" : "paused",
                          })
                        }
                      />
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(row.lastSentAt)}
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(row.createdAt)}
                    </TD>
                    <TD>
                      <RowActionsMenu
                        actions={[
                          {
                            label: "View",
                            icon: "users",
                            href: `/drip-campaigns/${row.id}`,
                          },
                          {
                            label: "Edit",
                            icon: "pencil",
                            href: `/drip-campaigns/${row.id}/edit`,
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
            <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 text-[12px] text-slate-500">
              1 of 1
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
