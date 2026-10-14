"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Check,
  Copy,
  Megaphone,
  MessageSquare,
  MoreVertical,
  PencilLine,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import {
  cancelScheduledCampaign,
  deleteCampaignDraft,
  displayCampaignStatus,
  duplicateCampaign,
  fetchCampaigns,
  formatSavedAt,
  formatScheduledAt,
  normalizeCampaignStatus,
  readCampaignTimezone,
  statusMatchesFilter,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { formatNumber } from "@/lib/utils";
import { PageHeader, Pill, EmptyState, Callout } from "@/newui-transplant/components/app/kit";
import { OpusDataSurface } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/newui-transplant/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sending", label: "Sending" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "canceled", label: "Canceled" },
] as const;

function statusTone(status: string): "success" | "neutral" | "warning" | "primary" {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return "success";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "warning";
  if (s === "scheduled" || s === "sending" || s === "queued") return "primary";
  return "neutral";
}

export function CampaignsListOpus({
  onCreate,
  editCampaignPath,
  rowFilter,
  fetchStatus,
  title = "All Campaigns",
  subtitle = "View and manage all of your campaigns.",
  defaultFilter = "all",
  lockFilter = false,
  initialRows = [],
}: {
  onCreate: () => void;
  editCampaignPath?: (id: string) => string;
  rowFilter?: (row: CampaignListRow) => boolean;
  fetchStatus?: string;
  title?: string;
  subtitle?: string;
  defaultFilter?: string;
  lockFilter?: boolean;
  initialRows?: CampaignListRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CampaignListRow[]>(initialRows);
  const [loading, setLoading] = useState(initialRows.length === 0);
  const retainInitialRef = useRef(initialRows.length > 0);
  const [filter, setFilter] = useState(defaultFilter);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCampaigns({ status: fetchStatus, take: 200 })
      .then((data) => {
        const next = rowFilter ? data.filter(rowFilter) : data;
        if (next.length === 0 && retainInitialRef.current) return;
        if (next.length > 0) retainInitialRef.current = false;
        setRows(next);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load campaigns");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [rowFilter, fetchStatus]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (!statusMatchesFilter(c.status, filter)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.audience || "").toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const clone = async (c: CampaignListRow) => {
    try {
      const newId = await duplicateCampaign(c.id);
      notify("Campaign cloned.");
      reload();
      router.push(editCampaignPath ? editCampaignPath(newId) : `/campaigns/new?edit=${newId}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not clone campaign");
    }
  };

  const removeDraft = async (c: CampaignListRow) => {
    if (!confirm(`Delete draft "${c.name}"? This cannot be undone.`)) return;
    try {
      await deleteCampaignDraft(c.id);
      notify("Draft deleted.");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not delete draft");
    }
  };

  const cancelScheduled = async (c: CampaignListRow) => {
    if (!confirm(`Cancel scheduled campaign "${c.name}"? Queued messages will not be sent.`)) return;
    try {
      await cancelScheduledCampaign(c.id);
      notify("Campaign canceled.");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not cancel campaign");
    }
  };

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? "All";

  return (
    <div className="flex flex-col gap-4">
      {toast ? (
        <Callout tone="success" title={toast} icon={Check} className="animate-in fade-in" />
      ) : null}

      <PageHeader
        title={title}
        description={subtitle}
        actions={
          <Button type="button" onClick={onCreate}>
            <Megaphone className="size-4" aria-hidden="true" />
            Create campaign
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {!lockFilter ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Filter
                  {filter !== "all" ? (
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {activeFilterLabel}
                    </span>
                  ) : null}
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {FILTER_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.id} onClick={() => setFilter(option.id)}>
                  {option.label}
                  {filter === option.id ? <Check className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns"
            className="pl-9"
            aria-label="Search campaigns"
          />
        </div>
      </div>

      {error ? <Callout tone="danger" title={error} /> : null}

      <OpusDataSurface className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold" scope="col">Campaign</th>
                <th className="px-4 py-3 font-semibold" scope="col">Audience</th>
                <th className="px-2 py-3" scope="col" aria-hidden="true" />
                <th className="px-4 py-3 font-semibold" scope="col">Performance</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Status</th>
                <th className="w-12 px-2 py-3" scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    Loading campaigns…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      icon={Megaphone}
                      title="No campaigns found"
                      description="Create your first bulk SMS campaign to reach your audience."
                      action={
                        <Button type="button" onClick={onCreate}>Create campaign</Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const norm = normalizeCampaignStatus(c.status);
                  const isSent = norm === "completed" || norm === "sent";
                  const statusLabel = displayCampaignStatus(c.status);
                  const recipients = isSent
                    ? c.sent ?? 0
                    : c.recipientCount && c.recipientCount > 0
                      ? c.recipientCount
                      : 0;
                  const savedAt = formatSavedAt(c.createdAt);
                  const scheduleAt =
                    norm === "scheduled" && c.scheduledAt
                      ? formatScheduledAt(c.scheduledAt, readCampaignTimezone(c.configJson))
                      : "";

                  return (
                    <tr key={c.id} className="border-b border-border/60 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {c.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{scheduleAt || savedAt || "—"}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden="true" />
                          <div>
                            <p className="font-medium tabular-nums">
                              {recipients > 0 ? formatNumber(recipients) : "—"}
                            </p>
                            <p className="max-w-[140px] truncate text-xs text-muted-foreground">
                              {c.audience || "Audience"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <MessageSquare className="size-4 text-muted-foreground/40" aria-hidden="true" />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isSent ? (
                          <div className="flex flex-wrap gap-4 text-xs">
                            <div>
                              <p className="font-semibold tabular-nums">{formatNumber(c.clicks ?? 0)}</p>
                              <p className="text-muted-foreground">Clicks</p>
                            </div>
                            <div>
                              <p className="font-semibold tabular-nums">{formatNumber(c.replies ?? 0)}</p>
                              <p className="text-muted-foreground">Replies</p>
                            </div>
                            <div>
                              <p className="font-semibold tabular-nums">{formatNumber(c.optOuts ?? 0)}</p>
                              <p className="text-muted-foreground">Opt-outs</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not sent yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <Pill tone={statusTone(c.status)}>{statusLabel}</Pill>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="Campaign actions">
                                <MoreVertical className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem render={<Link href={`/campaigns/${c.id}`} />}>
                              <BarChart2 className="size-4" /> Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void clone(c)}>
                              <Copy className="size-4" /> Clone
                            </DropdownMenuItem>
                            {(norm === "draft" || norm === "scheduled" || norm === "paused") && (
                              <DropdownMenuItem
                                render={<Link href={`/campaigns/new?edit=${c.id}`} />}
                              >
                                <PencilLine className="size-4" /> Edit
                              </DropdownMenuItem>
                            )}
                            {norm === "draft" && (
                              <DropdownMenuItem onClick={() => void removeDraft(c)}>
                                <Trash2 className="size-4" /> Delete
                              </DropdownMenuItem>
                            )}
                            {norm === "scheduled" && (
                              <DropdownMenuItem onClick={() => void cancelScheduled(c)}>
                                <XCircle className="size-4" /> Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "campaign" : "campaigns"}
            {filter !== "all" ? ` · ${activeFilterLabel}` : ""}
          </p>
        ) : null}
      </OpusDataSurface>
    </div>
  );
}
