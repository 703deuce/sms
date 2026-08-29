"use client";

import { CampaignActions, campaignLooksLikeMassText } from "@/components/campaigns/campaign-actions";
import {
  CampaignFilterTabs,
  CampaignPageShell,
  campaignUi,
} from "@/components/campaigns/broadcast/campaign-layout";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { Copy, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CampaignStats = {
  id: string;
  name: string;
  status: string;
  audience?: string;
  body?: string;
  sent: number;
  delivered: number;
  clicks: number;
  replies: number;
  optOuts: number;
  configJson?: unknown;
};

type RecipientRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  deliveredAt?: string | null;
  clickedAt?: string | null;
  repliedAt?: string | null;
  optedOutAt?: string | null;
  failureReason?: string | null;
};

const RESULT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "recipients", label: "Recipients" },
  { id: "clicks", label: "Clicks" },
  { id: "replies", label: "Replies" },
  { id: "opt-outs", label: "Opt-Outs" },
  { id: "activity", label: "Activity" },
];

const RECIPIENT_FILTERS = ["All", "Delivered", "Failed", "Clicked", "Replied", "Opt-Outs"];

function formatTs(at?: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CampaignResultsView({
  campaign,
  recipients = [],
}: {
  campaign: CampaignStats;
  recipients?: RecipientRow[];
}) {
  const [tab, setTab] = useState("overview");
  const [recipientFilter, setRecipientFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(campaign);

  const isSending = ["SENDING", "Sending", "sending"].includes(campaign.status);

  useEffect(() => {
    setLive(campaign);
  }, [campaign]);

  useEffect(() => {
    if (!isSending) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/mass-texting/campaigns/${campaign.id}/stats`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) {
          setLive((prev) => ({
            ...prev,
            sent: json.data.sent ?? prev.sent,
            delivered: json.data.delivered ?? prev.delivered,
            clicks: json.data.clicks ?? prev.clicks,
            replies: json.data.replies ?? prev.replies,
            optOuts: json.data.optOuts ?? prev.optOuts,
            status: json.data.status ?? prev.status,
          }));
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const timer = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [campaign.id, isSending]);

  const deliveryRate = live.sent > 0 ? (live.delivered / live.sent) * 100 : 0;
  const clickRate = live.delivered > 0 ? (live.clicks / live.delivered) * 100 : 0;
  const replyRate = live.delivered > 0 ? (live.replies / live.delivered) * 100 : 0;
  const optOutRate = live.delivered > 0 ? (live.optOuts / live.delivered) * 100 : 0;
  const pending = Math.max(0, live.sent - live.delivered);

  const filteredRecipients = useMemo(() => {
    let rows = recipients;
    if (recipientFilter !== "All") {
      rows = rows.filter((r) =>
        r.status.toLowerCase().includes(recipientFilter.toLowerCase().replace("-", "")),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q),
      );
    }
    return rows;
  }, [recipients, recipientFilter, search]);

  return (
    <CampaignPageShell
      title={campaign.name}
      subtitle={campaign.audience}
      actions={
        <>
          <Link href={`/campaigns/new?duplicate=${campaign.id}`} className={campaignUi.outlineBtn}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Link>
          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
            isMassText={campaignLooksLikeMassText(campaign.configJson)}
          />
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Sent" value={formatNumber(live.sent)} />
        <MetricCard
          label="Delivered"
          value={formatNumber(live.delivered)}
          sub={formatPercent(deliveryRate)}
        />
        <MetricCard label="Pending" value={formatNumber(pending)} />
        <MetricCard label="Clicks" value={formatNumber(live.clicks)} sub={formatPercent(clickRate)} />
        <MetricCard label="Replies" value={formatNumber(live.replies)} sub={formatPercent(replyRate)} />
        <MetricCard label="Opt-outs" value={formatNumber(live.optOuts)} sub={formatPercent(optOutRate)} />
      </div>

      <CampaignFilterTabs
        tabs={RESULT_TABS}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={cn(campaignUi.card, "p-5")}>
            <h3 className="text-[14px] font-semibold text-[#111827]">Delivery</h3>
            <div className="mt-4 flex items-center gap-6">
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-[#059669] border-r-[#e5e7eb] border-b-[#fef3c7]">
                <span className="text-[18px] font-bold text-[#111827]">
                  {formatPercent(deliveryRate, 0)}
                </span>
              </div>
              <ul className="space-y-2 text-[13px]">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" />
                  Delivered {formatNumber(campaign.delivered)}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
                  Pending {formatNumber(pending)}
                </li>
              </ul>
            </div>
          </div>
          <div className={cn(campaignUi.card, "p-5")}>
            <h3 className="text-[14px] font-semibold text-[#111827]">Engagement Over Time</h3>
            <div className="mt-6 flex h-32 items-end gap-2">
              {[live.clicks, live.replies, live.clicks * 0.6, live.replies * 1.2].map(
                (v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-[#6366f1]/70"
                    style={{ height: `${Math.max(8, Math.min(100, v * 4))}%` }}
                  />
                ),
              )}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-[#6b7280]">
              <span>Clicks</span>
              <span>Replies</span>
            </div>
          </div>
          {campaign.body ? (
            <div className={cn(campaignUi.card, "p-5 lg:col-span-2")}>
              <h3 className="text-[14px] font-semibold text-[#111827]">Message</h3>
              <p className="mt-3 whitespace-pre-wrap text-[13px] text-[#374151]">{campaign.body}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "recipients" ? (
        <div className="mt-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {RECIPIENT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setRecipientFilter(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                  recipientFilter === f
                    ? "bg-[#6366f1] text-white"
                    : "bg-[#f3f4f6] text-[#6b7280]",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className={cn(campaignUi.input, "pl-9")}
            />
          </div>
          <div className={cn(campaignUi.card, "overflow-x-auto")}>
            <table className="w-full min-w-[800px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] bg-[#fafafa] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Delivered At</th>
                  <th className="px-4 py-3">Clicked At</th>
                  <th className="px-4 py-3">Replied At</th>
                  <th className="px-4 py-3">Opt-out At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#6b7280]">
                      No recipients to show yet.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{r.phone}</td>
                      <td className="px-4 py-3">
                        <RecipientStatus status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-[#6b7280]">{r.failureReason || "—"}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{formatTs(r.deliveredAt)}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{formatTs(r.clickedAt)}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{formatTs(r.repliedAt)}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{formatTs(r.optedOutAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab !== "overview" && tab !== "recipients" ? (
        <div className={cn(campaignUi.card, "mt-4 p-8 text-center text-[14px] text-[#6b7280]")}>
          {tab.charAt(0).toUpperCase() + tab.slice(1)} data appears as engagement is recorded.
        </div>
      ) : null}
    </CampaignPageShell>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cn(campaignUi.card, "p-4")}>
      <p className="text-[12px] font-medium text-[#6b7280]">{label}</p>
      <p className="mt-1 text-[24px] font-bold tabular-nums text-[#111827]">{value}</p>
      {sub ? <p className="text-[12px] text-[#059669]">{sub}</p> : null}
    </div>
  );
}

function RecipientStatus({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes("deliver") || s.includes("sent")
      ? "bg-[#ecfdf5] text-[#059669]"
      : s.includes("fail")
        ? "bg-[#fef2f2] text-[#dc2626]"
        : "bg-[#f3f4f6] text-[#6b7280]";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {status}
    </span>
  );
}
