/** @deprecated Use CampaignsList via KimiCampaignsConnected — legacy duplicate list UI. */
"use client";

import { CampaignActions, campaignLooksLikeMassText } from "@/components/campaigns/campaign-actions";
import { cn, formatNumber } from "@/lib/utils";
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Copy,
  Megaphone,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CampaignRow = {
  id: string;
  name: string;
  audience?: string;
  status: string;
  sent?: number;
  delivered?: number;
  clicks?: number;
  replies?: number;
  optOuts?: number;
  scheduledAt?: string | null;
  createdAt?: string;
  configJson?: unknown;
};

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sending", label: "Sending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

function statusMatchesFilter(status: string, filter: string): boolean {
  if (filter === "all") return true;
  const s = normalizeStatus(status);
  if (filter === "draft") return s === "draft";
  if (filter === "scheduled") return s === "scheduled";
  if (filter === "sending") return s === "sending" || s === "queued";
  if (filter === "completed") return s === "completed" || s === "sent";
  if (filter === "failed") return s === "failed" || s === "canceled";
  return true;
}

function formatSavedAt(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayStatus(status: string): string {
  const s = normalizeStatus(status);
  if (s === "completed" || s === "sent") return "Sent";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Kimi session 2026-08-30T21-40-34-537Z-32b6ff — presentation ported from
 * `.ui-agent/generated/.../components/CampaignsList.tsx`, wired to production API.
 */
export function CampaignListView() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mass-texting/campaigns")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setCampaigns(json.data || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (!statusMatchesFilter(c.status, filter)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.audience || "").toLowerCase().includes(q);
    });
  }, [campaigns, filter, search]);

  return (
    <div className="st-fade">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
          <Megaphone size={18} className="text-indigo-600" />
        </div>
        <h1 className="text-[22px] font-semibold text-foreground">Campaigns</h1>
      </div>
      <p className="mb-5 ml-12 text-[13.5px] text-gray-500">
        View and manage all of your campaigns.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50"
          >
            <ChevronDown size={14} /> Filter
          </button>
          {filterOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-white py-1 shadow-lg st-fade">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setFilter(option.id);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-[13px] hover:bg-gray-50",
                    filter === option.id ? "font-medium text-indigo-600" : "text-gray-700",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"
        >
          Create Campaign
        </Link>
      </div>

      <div className="overflow-visible rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_130px_60px_220px_90px_40px] items-center border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <div>Campaign</div>
          <div />
          <div />
          <div />
          <div className="flex items-center gap-1">
            Status <ChevronDown size={12} />
          </div>
          <div />
        </div>

        {loading ? (
          <p className="p-8 text-center text-[14px] text-gray-500">Loading campaigns…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[15px] font-medium text-gray-900">No campaigns yet</p>
            <p className="mt-1 text-[14px] text-gray-500">
              Create your first bulk SMS campaign to reach your audience.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              Create Campaign
            </Link>
          </div>
        ) : (
          filtered.map((c) => {
            const isSent =
              normalizeStatus(c.status) === "completed" ||
              normalizeStatus(c.status) === "sent";
            const statusLabel = displayStatus(c.status);
            const recipients = isSent ? c.sent ?? 0 : 0;
            const savedAt = formatSavedAt(c.scheduledAt || c.createdAt);

            return (
              <div
                key={c.id}
                onClick={() => setSelected((current) => (current === c.id ? null : c.id))}
                className={cn(
                  "st-row relative grid cursor-pointer grid-cols-[1fr_130px_60px_220px_90px_40px] items-center border-b border-border px-5 py-4 last:border-0",
                  selected === c.id && "selected",
                )}
              >
                <div>
                  <Link
                    href={`/campaigns/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[13.5px] font-medium text-gray-900 hover:text-indigo-600"
                  >
                    {c.name}
                  </Link>
                  {savedAt ? (
                    <div className="mt-0.5 text-[12px] text-gray-400">{savedAt}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <Users size={15} className="text-indigo-400" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {recipients > 0 ? formatNumber(recipients) : "—"}
                    </div>
                    <div className="text-[11px] text-gray-400">{c.audience || "Audience"}</div>
                  </div>
                </div>

                <div>{(c.replies ?? 0) > 0 ? <MessageSquare size={16} className="text-gray-300" /> : null}</div>

                <div className="flex items-center gap-6 text-[13px]">
                  {isSent ? (
                    <>
                      <div>
                        <div className="font-medium text-gray-900">{formatNumber(c.clicks ?? 0)}</div>
                        <div className="text-[11px] text-gray-400">Clicks</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{formatNumber(c.optOuts ?? 0)}</div>
                        <div className="text-[11px] text-gray-400">Unsubs</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">—</div>
                        <div className="text-[11px] text-gray-400">Revenue</div>
                      </div>
                    </>
                  ) : (
                    <div />
                  )}
                </div>

                <div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
                      isSent ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {isSent ? <CheckCircle2 size={12} /> : null}
                    {statusLabel}
                  </span>
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuFor === c.id ? (
                    <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-border bg-white py-1 shadow-lg st-fade">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                      >
                        <BarChart2 size={14} className="text-gray-400" />
                        Analytics
                      </Link>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50"
                      >
                        <Copy size={14} className="text-gray-400" />
                        Clone
                      </button>
                      <div className="border-t border-gray-100 px-1 py-1">
                        <CampaignActions
                          campaignId={c.id}
                          status={c.status}
                          variant="row"
                          isMassText={campaignLooksLikeMassText(c.configJson)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
