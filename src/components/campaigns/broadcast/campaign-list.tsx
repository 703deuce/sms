"use client";

import { CampaignActions, campaignLooksLikeMassText } from "@/components/campaigns/campaign-actions";
import {
  CampaignFilterTabs,
  CampaignPageShell,
  campaignUi,
} from "@/components/campaigns/broadcast/campaign-layout";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { MoreHorizontal, Plus, Search } from "lucide-react";
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
  revenue?: number;
  scheduledAt?: string | null;
  createdAt?: string;
  configJson?: unknown;
};

const FILTER_TABS = [
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

function StatusBadge({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const tone =
    s === "completed" || s === "sent"
      ? "bg-[#ecfdf5] text-[#059669]"
      : s === "scheduled"
        ? "bg-[#eef2ff] text-[#6366f1]"
        : s === "sending" || s === "queued"
          ? "bg-[#fff7ed] text-[#ea580c]"
          : s === "failed" || s === "canceled"
            ? "bg-[#fef2f2] text-[#dc2626]"
            : "bg-[#f3f4f6] text-[#6b7280]";
  const label =
    s === "completed"
      ? "Sent"
      : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone)}>
      {label}
    </span>
  );
}

export function CampaignListView() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
    <CampaignPageShell
      title="Campaigns"
      subtitle="View and manage all of your campaigns."
      actions={
        <Link href="/campaigns/new" className={campaignUi.primaryBtn}>
          <Plus className="h-4 w-4" />
          Create Campaign
        </Link>
      }
    >
      <CampaignFilterTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="search"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(campaignUi.input, "pl-9")}
          />
        </div>
      </div>

      <div className={cn(campaignUi.card, "overflow-hidden")}>
        {loading ? (
          <p className="p-8 text-center text-[14px] text-[#6b7280]">Loading campaigns…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[15px] font-medium text-[#111827]">No campaigns yet</p>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              Create your first bulk SMS campaign to reach your audience.
            </p>
            <Link href="/campaigns/new" className={cn(campaignUi.primaryBtn, "mt-4 inline-flex")}>
              <Plus className="h-4 w-4" />
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">Replies</th>
                  <th className="px-4 py-3 text-right">Opt-outs</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((c) => {
                  const sent = c.sent ?? 0;
                  const delivered = c.delivered ?? 0;
                  const deliveryPct = sent > 0 ? (delivered / sent) * 100 : 0;
                  const isDone =
                    normalizeStatus(c.status) === "completed" ||
                    normalizeStatus(c.status) === "sent";
                  return (
                    <tr key={c.id} className="hover:bg-[#fafafa]">
                      <td className="px-5 py-4">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="font-semibold text-[#111827] hover:text-[#6366f1]"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-[#6b7280]">{c.audience || "—"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-[#374151]">
                        {isDone ? formatNumber(sent) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-[#374151]">
                        {isDone ? (
                          <>
                            {formatNumber(delivered)}
                            <span className="ml-1 text-[11px] text-[#9ca3af]">
                              ({formatPercent(deliveryPct)})
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-[#374151]">
                        {isDone ? formatNumber(c.clicks ?? 0) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-[#374151]">
                        {isDone ? formatNumber(c.replies ?? 0) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-[#374151]">
                        {isDone ? formatNumber(c.optOuts ?? 0) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <CampaignActions
                            campaignId={c.id}
                            status={c.status}
                            variant="row"
                            isMassText={campaignLooksLikeMassText(c.configJson)}
                          />
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CampaignPageShell>
  );
}
