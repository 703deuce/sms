"use client";

import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import {
  MockupListToolbar,
  MockupTablePagination,
} from "@/components/automate/mockup-automate-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { listGrowthTabs } from "@/lib/list-growth-tabs";
import { formatNumber } from "@/lib/utils";
import { Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TapRow = {
  id: string;
  name: string;
  keyword?: string | null;
  listName?: string | null;
  phoneLabel?: string | null;
  status: string;
  clicks: number;
  joinCount: number;
  updatedAt: string;
};

export default function TapToJoinPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TapRow[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/growth/tap-to-join");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.keyword || "").toLowerCase().includes(q) ||
        (r.listName || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function patchStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/growth/tap-to-join/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateRow(row: TapRow) {
    setBusyId(row.id);
    try {
      const detail = await fetch(`/api/growth/tap-to-join/${row.id}`);
      const json = await detail.json();
      if (!detail.ok) return;
      const res = await fetch("/api/growth/tap-to-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          keywordId: json.data.keywordId,
          phoneNumberId: json.data.phoneNumberId,
          buttonText: json.data.buttonText,
        }),
      });
      const created = await res.json();
      if (res.ok) router.push(`/grow/tap-to-join/${created.data.id}`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this Tap-to-Join link?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/growth/tap-to-join/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tap-to-Join"
        description="Create mobile links that open the visitor's texting app with your number and join keyword ready to send."
        actions={
          <Button asChild>
            <Link href="/grow/tap-to-join/new">
              <Plus className="h-4 w-4" />
              Create Tap-to-Join
            </Link>
          </Button>
        }
      />
      <Tabs items={[...listGrowthTabs]} />

      <div className="mb-4">
        <MockupListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search Tap-to-Join links…"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No Tap-to-Join links yet"
            description="Create a link that opens SMS with your keyword prefilled. Enrollment still happens when the visitor presses Send."
            action={
              <Button asChild>
                <Link href="/grow/tap-to-join/new">Create Tap-to-Join</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Keyword</TH>
                <TH>Sending Number</TH>
                <TH>Destination List</TH>
                <TH>Status</TH>
                <TH>Clicks</TH>
                <TH>Joins</TH>
                <TH>Last Updated</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">
                    <Link href={`/grow/tap-to-join/${row.id}`} className="text-indigo-600 hover:underline">
                      {row.name}
                    </Link>
                  </TD>
                  <TD>{row.keyword || "—"}</TD>
                  <TD className="text-sm text-slate-600">{row.phoneLabel || "—"}</TD>
                  <TD>{row.listName || "—"}</TD>
                  <TD>
                    <StatusChip status={row.status === "Active" ? "active" : "paused"} />
                  </TD>
                  <TD>{formatNumber(row.clicks)}</TD>
                  <TD>{formatNumber(row.joinCount)}</TD>
                  <TD className="text-sm text-slate-500">
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-right">
                    <RowActionsMenu
                      actions={[
                        { label: "Edit", icon: "pencil", href: `/grow/tap-to-join/${row.id}` },
                        {
                          label: "Copy Link",
                          icon: "copy",
                          onClick: async () => {
                            const res = await fetch(`/api/growth/tap-to-join/${row.id}`);
                            const json = await res.json();
                            if (json.data?.publicUrl) await navigator.clipboard.writeText(json.data.publicUrl);
                          },
                        },
                        {
                          label: "Copy Button Code",
                          icon: "copy",
                          onClick: async () => {
                            const res = await fetch(`/api/growth/tap-to-join/${row.id}`);
                            const json = await res.json();
                            if (json.data?.buttonHtml) await navigator.clipboard.writeText(json.data.buttonHtml);
                          },
                        },
                        {
                          label: row.status === "Active" ? "Pause" : "Activate",
                          icon: "users",
                          onClick: () =>
                            patchStatus(row.id, row.status === "Active" ? "Paused" : "Active"),
                        },
                        { label: "Duplicate", icon: "copy", onClick: () => duplicateRow(row) },
                        {
                          label: "Delete",
                          icon: "trash",
                          destructive: true,
                          onClick: () => deleteRow(row.id),
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
      <MockupTablePagination total={filtered.length} />
    </div>
  );
}
