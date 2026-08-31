"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, Users, MessageSquare, MoreVertical, BarChart2, Copy, Megaphone, Check, CheckCircle2, ChevronDown, Plus,
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

export default function CampaignsList({
  onCreate,
  editCampaignPath,
}: {
  onCreate: () => void;
  editCampaignPath?: (id: string) => string;
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
      .then(setRows)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load campaigns");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb]">
      {toast && (
        <div className="toast">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}
      <header className="px-8 pt-7 pb-5">
        <h1 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-50">
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </span>
          Campaigns
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">View and manage all of your campaigns.</p>
      </header>

      <div className="px-8 flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="btn-ghost flex items-center gap-2 !py-2 !px-3.5 text-slate-600"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400" /> Filter
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg fade-in">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setFilter(option.id); setFilterOpen(false); }}
                  className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50 ${filter === option.id ? "font-medium text-indigo-600" : "text-slate-700"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns"
            className="input-field !pl-9 !text-[13.5px]"
          />
        </div>
        <button type="button" className="btn-primary" onClick={onCreate}>Create Campaign</button>
      </div>

      <div className="px-8 mt-5 pb-10">
        {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}
        <div className="camp-table">
          <div className="camp-row camp-head text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            <span>Campaign</span><span></span><span></span><span></span><span className="text-right">Status</span><span></span>
          </div>
          {loading ? (
            <div className="px-6 py-14 text-center text-[13px] text-slate-500">Loading campaigns…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-700">No campaigns found</p>
              <p className="text-[13px] text-slate-400 mt-1">Create your first bulk SMS campaign to reach your audience.</p>
              <button type="button" onClick={onCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Campaign
              </button>
            </div>
          ) : (
            filtered.map((c) => {
              const isSent =
                normalizeCampaignStatus(c.status) === "completed" ||
                normalizeCampaignStatus(c.status) === "sent";
              const statusLabel = displayCampaignStatus(c.status);
              const recipients = isSent ? c.sent ?? 0 : 0;
              const savedAt = formatSavedAt(c.scheduledAt || c.createdAt);

              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c.id === selected ? null : c.id)}
                  className={`camp-row cursor-pointer ${selected === c.id ? "selected" : ""}`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[14px] font-semibold text-slate-800 truncate hover:text-indigo-600 block"
                    >
                      {c.name}
                    </Link>
                    <p className="text-[12px] text-slate-400 mt-0.5">{savedAt || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">
                        {recipients > 0 ? formatNumber(recipients) : "—"}
                      </p>
                      <p className="text-[11px] text-slate-400">{c.audience || "Audience"}</p>
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-slate-300 justify-self-center" />
                  <div className="flex items-center gap-6">
                    {isSent ? (
                      <>
                        <div><p className="text-[13px] font-semibold text-slate-800 leading-tight">{formatNumber(c.clicks ?? 0)}</p><p className="text-[11px] text-slate-400">Clicks</p></div>
                        <div><p className="text-[13px] font-semibold text-slate-800 leading-tight">{formatNumber(c.optOuts ?? 0)}</p><p className="text-[11px] text-slate-400">Unsubs</p></div>
                        <div><p className="text-[13px] font-semibold text-slate-800 leading-tight">—</p><p className="text-[11px] text-slate-400">Revenue</p></div>
                      </>
                    ) : <span />}
                  </div>
                  <div className="text-right">
                    <span className={`status-pill ${isSent ? "sent" : "draft"} inline-flex items-center gap-1`}>
                      {isSent ? <CheckCircle2 className="w-3 h-3" /> : null}
                      {statusLabel}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuFor === c.id && (
                      <div className="kebab-menu fade-in" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/campaigns/${c.id}`} onClick={() => setMenuFor(null)}>
                          <BarChart2 className="w-4 h-4" /> Analytics
                        </Link>
                        <button type="button" onClick={() => void clone(c)}><Copy className="w-4 h-4" /> Clone</button>
                        {normalizeCampaignStatus(c.status) === "draft" && (
                          <Link href={`/campaigns/new?edit=${c.id}`} onClick={() => setMenuFor(null)}>
                            <ChevronDown className="w-4 h-4" /> Edit draft
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
