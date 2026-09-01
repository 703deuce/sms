"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, Users, MessageSquare, MoreVertical, BarChart2, Copy, Megaphone, Check, CheckCircle2, ChevronDown, Plus, PencilLine,
} from "lucide-react";
import {
  duplicateCampaign,
  displayCampaignStatus,
  fetchCampaigns,
  formatSavedAt,
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
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

function statusPillClasses(status: string): string {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70";
  if (s === "scheduled")
    return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70";
  if (s === "sending" || s === "queued")
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70";
  if (s === "failed" || s === "canceled" || s === "cancelled")
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70";
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
}

function statusDot(status: string): string {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return "bg-emerald-500";
  if (s === "scheduled") return "bg-indigo-500";
  if (s === "sending" || s === "queued") return "bg-amber-500";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "bg-rose-500";
  return "bg-slate-400";
}

export default function CampaignsList({
  onCreate,
  editCampaignPath,
  rowFilter,
  title = "Campaigns",
  subtitle = "Create and manage your text message campaigns.",
}: {
  onCreate: () => void;
  editCampaignPath?: (id: string) => string;
  rowFilter?: (row: CampaignListRow) => boolean;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCampaigns()
      .then((data) => (rowFilter ? data.filter(rowFilter) : data))
      .then(setRows)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load campaigns");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [rowFilter]);

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

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? "All";

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb]">
      {toast && (
        <div className="toast">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}
      <header className="px-8 pt-8 pb-6">
        <h1 className="flex items-center gap-3 text-[22px] font-bold tracking-tight text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/10">
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </span>
          {title}
        </h1>
        <p className="mt-1.5 pl-[52px] text-[13.5px] text-slate-500">{subtitle}</p>
      </header>

      <div className="flex items-center gap-3 px-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            Filter
            {filter !== "all" ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-200/60">
                {activeFilterLabel}
              </span>
            ) : null}
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl fade-in">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setFilter(option.id); setFilterOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-slate-50 ${filter === option.id ? "font-semibold text-indigo-600" : "text-slate-700"}`}
                >
                  {option.label}
                  {filter === option.id ? <Check className="w-3.5 h-3.5" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Create Campaign
        </button>
      </div>

      <div className="px-8 pb-10 pt-5">
        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[minmax(0,2fr)_1.2fr_32px_1.2fr_130px_44px] items-center gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">
            <span>Campaign</span>
            <span>Audience</span>
            <span></span>
            <span>Performance</span>
            <span className="text-right">Status</span>
            <span></span>
          </div>
          {loading ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              <p className="mt-3 text-[13px] text-slate-500">Loading campaigns…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                <Megaphone className="h-5.5 h-[22px] w-[22px] text-indigo-500" />
              </span>
              <p className="mt-4 text-sm font-semibold text-slate-800">No campaigns found</p>
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-400">
                Create your first bulk SMS campaign to reach your audience.
              </p>
              <button
                type="button"
                onClick={onCreate}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Create Campaign
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const norm = normalizeCampaignStatus(c.status);
                const isSent = norm === "completed" || norm === "sent";
                const statusLabel = displayCampaignStatus(c.status);
                const recipients = isSent ? c.sent ?? 0 : 0;
                const savedAt = formatSavedAt(c.scheduledAt || c.createdAt);

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c.id === selected ? null : c.id)}
                    className={`grid cursor-pointer grid-cols-[minmax(0,2fr)_1.2fr_32px_1.2fr_130px_44px] items-center gap-4 px-5 py-4 transition-colors ${
                      selected === c.id ? "bg-indigo-50/40" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/campaigns/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-[14px] font-semibold text-slate-800 transition-colors hover:text-indigo-600"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-slate-400">{savedAt || "—"}</p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2.5 text-slate-600">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100/70">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight text-slate-700">
                          {recipients > 0 ? formatNumber(recipients) : "—"}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">{c.audience || "Audience"}</p>
                      </div>
                    </div>
                    <MessageSquare className="w-4 h-4 justify-self-center text-slate-300" />
                    <div className="flex items-center gap-6">
                      {isSent ? (
                        <>
                          <div><p className="text-[13px] font-semibold leading-tight text-slate-800">{formatNumber(c.clicks ?? 0)}</p><p className="text-[11px] text-slate-400">Clicks</p></div>
                          <div><p className="text-[13px] font-semibold leading-tight text-slate-800">{formatNumber(c.optOuts ?? 0)}</p><p className="text-[11px] text-slate-400">Unsubs</p></div>
                          <div><p className="text-[13px] font-semibold leading-tight text-slate-800">—</p><p className="text-[11px] text-slate-400">Revenue</p></div>
                        </>
                      ) : <span className="text-[12px] text-slate-300">Not sent yet</span>}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${statusPillClasses(c.status)}`}>
                        {isSent ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                        )}
                        {statusLabel}
                      </span>
                    </div>
                    <div className="relative justify-self-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Campaign actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuFor === c.id && (
                        <div className="kebab-menu fade-in" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/campaigns/${c.id}`} onClick={() => setMenuFor(null)}>
                            <BarChart2 className="w-4 h-4" /> Analytics
                          </Link>
                          <button type="button" onClick={() => void clone(c)}><Copy className="w-4 h-4" /> Clone</button>
                          {norm === "draft" && (
                            <Link href={`/campaigns/new?edit=${c.id}`} onClick={() => setMenuFor(null)}>
                              <PencilLine className="w-4 h-4" /> Edit draft
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
