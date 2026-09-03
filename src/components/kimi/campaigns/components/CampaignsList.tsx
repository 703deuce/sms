"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Users,
  MessageSquare,
  MoreVertical,
  BarChart2,
  Copy,
  Megaphone,
  Check,
  PencilLine,
  Trash2,
} from "lucide-react";
import {
  duplicateCampaign,
  deleteCampaignDraft,
  displayCampaignStatus,
  fetchCampaigns,
  formatSavedAt,
  formatScheduledAt,
  normalizeCampaignStatus,
  statusMatchesFilter,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { formatNumber } from "@/lib/utils";

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sending", label: "Sending" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "canceled", label: "Canceled" },
];

function statusPillVariant(status: string): string {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return "sent";
  if (s === "scheduled") return "scheduled";
  if (s === "sending" || s === "queued") return "sending";
  if (s === "paused") return "paused";
  if (s === "failed") return "failed";
  if (s === "canceled" || s === "cancelled") return "canceled";
  return "draft";
}

export default function CampaignsList({
  onCreate,
  editCampaignPath,
  rowFilter,
  fetchStatus,
  title = "Campaigns",
  subtitle = "View and manage all of your campaigns.",
  defaultFilter = "all",
  lockFilter = false,
}: {
  onCreate: () => void;
  editCampaignPath?: (id: string) => string;
  rowFilter?: (row: CampaignListRow) => boolean;
  fetchStatus?: string;
  title?: string;
  subtitle?: string;
  defaultFilter?: string;
  lockFilter?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(defaultFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCampaigns({ status: fetchStatus, take: 200 })
      .then((data) => (rowFilter ? data.filter(rowFilter) : data))
      .then(setRows)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load campaigns");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [rowFilter, fetchStatus]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!filterOpen && !menuFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setMenuFor(null);
      }
    };
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterOpen && !target.closest("[data-campaign-filter-root]")) {
        setFilterOpen(false);
      }
      if (menuFor && !target.closest(`[data-campaign-menu="${menuFor}"]`)) {
        setMenuFor(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [filterOpen, menuFor]);

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
    setTimeout(() => setToast(null), 3000);
  };

  const clone = async (c: CampaignListRow) => {
    setMenuFor(null);
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
    setMenuFor(null);
    if (!confirm(`Delete draft "${c.name}"? This cannot be undone.`)) return;
    try {
      await deleteCampaignDraft(c.id);
      notify("Draft deleted.");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not delete draft");
    }
  };

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? "All";

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb]">
      {toast ? (
        <div className="toast">
          <Check className="w-4 h-4" /> {toast}
        </div>
      ) : null}

      <header className="px-8 pt-7 pb-4">
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-slate-900">
          <Megaphone className="w-6 h-6 text-indigo-500" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </header>

      <div className="px-8 flex items-center gap-3">
        {!lockFilter ? (
          <div className="relative" data-campaign-filter-root>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="btn-ghost flex items-center gap-2 !py-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
              {filter !== "all" ? <span className="filter-badge">{activeFilterLabel}</span> : null}
            </button>
            {filterOpen ? (
              <div className="filter-menu fade-in">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setFilter(option.id);
                      setFilterOpen(false);
                    }}
                    className={filter === option.id ? "active" : undefined}
                  >
                    {option.label}
                    {filter === option.id ? <Check className="w-3.5 h-3.5" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="input-field !pl-9"
          />
        </div>
        <button type="button" className="btn-primary" onClick={onCreate}>
          Create Campaign
        </button>
      </div>

      <div className="px-8 mt-5 pb-10">
        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        ) : null}

        <div className="camp-table">
          <div className="camp-row camp-head !bg-transparent border-b border-slate-200 !py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Campaign</span>
            <span>Audience</span>
            <span />
            <span>Performance</span>
            <span className="text-right">Status</span>
            <span />
          </div>

          {loading ? (
            <div className="camp-row !cursor-default hover:!bg-white">
              <div className="col-span-full flex flex-col items-center py-10 text-center" style={{ gridColumn: "1 / -1" }}>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                <p className="mt-3 text-[13px] text-slate-500">Loading campaigns…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="camp-row !cursor-default hover:!bg-white">
              <div className="col-span-full flex flex-col items-center py-12 text-center" style={{ gridColumn: "1 / -1" }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                  <Megaphone className="h-5 w-5 text-indigo-500" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-800">No campaigns found</p>
                <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-400">
                  Create your first bulk SMS campaign to reach your audience.
                </p>
                <button type="button" className="btn-primary mt-5" onClick={onCreate}>
                  Create Campaign
                </button>
              </div>
            </div>
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
                norm === "scheduled" && c.scheduledAt ? formatScheduledAt(c.scheduledAt) : "";

              return (
                <div
                  key={c.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(c.id === selected ? null : c.id);
                    }
                  }}
                  onClick={() => setSelected(c.id === selected ? null : c.id)}
                  className={`camp-row cursor-pointer ${selected === c.id ? "selected" : ""}`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-[14px] font-semibold text-slate-800 hover:text-indigo-600"
                    >
                      {c.name}
                    </Link>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      {scheduleAt || savedAt || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 min-w-0">
                    <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{recipients > 0 ? formatNumber(recipients) : "—"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.audience || "Audience"}</p>
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-slate-300 justify-self-center" />
                  <div className="flex items-center gap-6">
                    {isSent ? (
                      <>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatNumber(c.clicks ?? 0)}</p>
                          <p className="text-[11px] text-slate-400">Clicks</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatNumber(c.replies ?? 0)}</p>
                          <p className="text-[11px] text-slate-400">Replies</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatNumber(c.optOuts ?? 0)}</p>
                          <p className="text-[11px] text-slate-400">Opt-outs</p>
                        </div>
                      </>
                    ) : (
                      <span className="text-[12px] text-slate-300">Not sent yet</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`status-pill ${statusPillVariant(c.status)}`}>{statusLabel}</span>
                  </div>
                  <div className="relative justify-self-end" data-campaign-menu={c.id}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor(menuFor === c.id ? null : c.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
                      aria-label="Campaign actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuFor === c.id ? (
                      <div className="kebab-menu fade-in" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/campaigns/${c.id}`} onClick={() => setMenuFor(null)}>
                          <BarChart2 className="w-4 h-4" /> Analytics
                        </Link>
                        <button type="button" onClick={() => void clone(c)}>
                          <Copy className="w-4 h-4" /> Clone
                        </button>
                        {(norm === "draft" || norm === "scheduled" || norm === "paused") && (
                          <Link href={`/campaigns/new?edit=${c.id}`} onClick={() => setMenuFor(null)}>
                            <PencilLine className="w-4 h-4" /> Edit
                          </Link>
                        )}
                        {norm === "draft" && (
                          <button type="button" onClick={() => void removeDraft(c)}>
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && filtered.length > 0 ? (
          <p className="mt-3 px-1 text-[12px] text-slate-400">
            {filtered.length} {filtered.length === 1 ? "campaign" : "campaigns"}
            {filter !== "all" ? ` · ${activeFilterLabel}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
