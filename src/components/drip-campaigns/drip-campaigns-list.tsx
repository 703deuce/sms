"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { DripStatusToggle } from "@/components/drip-campaigns/drip-ui";
import { MockupListToolbar } from "@/components/automate/mockup-automate-ui";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { fetchDripCampaigns } from "@/lib/drip-campaigns/drip-campaigns-adapter";
import {
  dripTriggerLabel,
  type DripCampaignRecord,
} from "@/lib/drip-campaigns/types";
import {
  dripCampaignDetailHref,
  dripCampaignEditHref,
  dripCampaignNewHref,
  dripCampaignsListHref,
} from "@/lib/drip-campaigns/routes";
import { cn, formatNumber } from "@/lib/utils";
import { Check, Layers, MessageSquare, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function StatusPill({ status }: { status: DripCampaignRecord["status"] }) {
  const styles =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : status === "paused"
        ? "bg-slate-100 text-slate-600 ring-slate-500/20"
        : "bg-amber-50 text-amber-700 ring-amber-600/20";
  const label =
    status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold leading-none ring-1 ring-inset",
        styles,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-emerald-500"
            : status === "paused"
              ? "bg-slate-400"
              : "bg-amber-500",
        )}
      />
      {label}
    </span>
  );
}

export function DripCampaignsList({
  initialRows,
  embedded = false,
}: {
  initialRows: DripCampaignRecord[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchDripCampaigns()
      .then(setRows)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load drip campaigns");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (
      pathname === dripCampaignsListHref() &&
      prevPathRef.current !== dripCampaignsListHref()
    ) {
      reload();
    }
    prevPathRef.current = pathname;
  }, [pathname, reload]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && row.status !== "active") return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        dripTriggerLabel(row.triggerType, row.triggerConfig).toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function patchRow(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/drip-campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      if (body.action === "duplicate" || json.created) {
        setRows((prev) => [json.data, ...prev.filter((r) => r.id !== json.data.id)]);
        notify("Campaign duplicated.");
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? json.data : r)));
        if (body.status === "active" || body.action === "toggle_status") {
          notify("Campaign activated.");
        } else if (body.status === "paused") {
          notify("Campaign paused.");
        }
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      notify(message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this drip campaign?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/drip-campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      notify("Campaign deleted.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      notify(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="text-[13px]">
      {toast ? (
        <div className="toast fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
          <Check className="h-4 w-4" /> {toast}
        </div>
      ) : null}

      <SlickAudienceHeader
        breadcrumb={embedded ? "Automations / Drip Campaigns" : "Campaigns / Drip Campaigns"}
        title="Drip Campaigns"
        description="Send a timed series of messages when someone triggers an event."
        icon={Layers}
        actions={
          <Link
            href={dripCampaignNewHref()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create Drip Campaign
          </Link>
        }
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm sm:p-5">
        <MockupListToolbar
          searchPlaceholder="Search campaigns..."
          searchValue={search}
          onSearchChange={setSearch}
          filterSlot={
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50/60 p-1">
              {(["all", "active"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "flex h-full items-center rounded-md px-3.5 text-[12px] font-semibold transition-colors",
                    statusFilter === value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {value === "all" ? "All" : "Active"}
                </button>
              ))}
            </div>
          }
        />

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
            <p className="mt-3 text-[13px] text-slate-500">Loading drip campaigns…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title={rows.length === 0 ? "No drip campaigns yet" : "No campaigns match your search"}
            description={
              rows.length === 0
                ? "Build a multi-message sequence that starts when a contact joins a list, gets a tag, and more."
                : "Try a different search term or clear the status filter."
            }
            actionLabel={rows.length === 0 ? "Create Drip Campaign" : undefined}
            actionHref={rows.length === 0 ? dripCampaignNewHref() : undefined}
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200 hover:bg-transparent">
                  <TH className="pl-4">Name</TH>
                  <TH className="hidden md:table-cell">Triggered by</TH>
                  <TH className="w-[110px]">Messages</TH>
                  <TH className="hidden w-[110px] sm:table-cell">Triggered</TH>
                  <TH className="min-w-[150px]">Status</TH>
                  <TH className="hidden lg:table-cell">Last Sent</TH>
                  <TH className="hidden xl:table-cell">Created</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((row) => (
                  <TR key={row.id} className="border-slate-100">
                    <TD className="min-w-[180px] py-4 pl-4">
                      <Link
                        href={dripCampaignDetailHref(row.id)}
                        className="text-[13px] font-semibold text-slate-900 no-underline transition-colors hover:text-primary"
                      >
                        {row.name}
                      </Link>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        Last saved {formatSlickDateTime(row.updatedAt)}
                      </p>
                    </TD>
                    <TD className="hidden max-w-[260px] md:table-cell">
                      <span className="inline-flex max-w-full items-center gap-1.5 text-slate-600">
                        <Zap className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {dripTriggerLabel(row.triggerType, row.triggerConfig)}
                        </span>
                      </span>
                    </TD>
                    <TD className="w-[110px]">
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {row.steps.length}
                      </span>
                    </TD>
                    <TD className="hidden w-[110px] tabular-nums text-slate-600 sm:table-cell">
                      {formatNumber(row.triggeredCount)}
                    </TD>
                    <TD className="min-w-[150px]">
                      <div className="flex items-center gap-3">
                        <DripStatusToggle
                          active={row.status === "active"}
                          disabled={busyId === row.id}
                          onChange={(next) =>
                            void patchRow(row.id, {
                              status: next ? "active" : "paused",
                            })
                          }
                        />
                        <StatusPill status={row.status} />
                      </div>
                    </TD>
                    <TD className="hidden whitespace-nowrap text-slate-500 lg:table-cell">
                      {formatSlickDateTime(row.lastSentAt)}
                    </TD>
                    <TD className="hidden whitespace-nowrap text-slate-500 xl:table-cell">
                      {formatSlickDateTime(row.createdAt)}
                    </TD>
                    <TD className="pr-3 text-right">
                      <RowActionsMenu
                        actions={[
                          {
                            label: "View",
                            icon: "users",
                            href: dripCampaignDetailHref(row.id),
                          },
                          {
                            label: "Edit",
                            icon: "pencil",
                            href: dripCampaignEditHref(row.id),
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
          </>
        )}
      </Card>
    </div>
  );
}
