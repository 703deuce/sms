"use client";

import { CampaignActions, campaignLooksLikeMassText } from "@/components/campaigns/campaign-actions";
import { V1Breadcrumb, V1PageHeader } from "@/components/v1/v1-polish";
import {
  campaignStatusEmoji,
  formatCampaignDateTime,
  type CampaignTimelineEvent,
} from "@/lib/campaigns/campaign-detail-helpers";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Copy, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CampaignStats = {
  id: string;
  name: string;
  status: string;
  audience?: string;
  body?: string;
  type?: string;
  sent: number;
  delivered: number;
  clicks: number;
  replies: number;
  optOuts: number;
  cost?: number;
  scheduledAt?: string | null;
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
  { id: "overview", label: "Overview", emoji: "📊" },
  { id: "recipients", label: "Recipients", emoji: "👥" },
  { id: "clicks", label: "Clicks", emoji: "👆" },
  { id: "replies", label: "Replies", emoji: "💬" },
  { id: "opt-outs", label: "Opt-Outs", emoji: "🚫" },
  { id: "activity", label: "Activity", emoji: "📋" },
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

function KpiCard({
  emoji,
  label,
  value,
  hint,
}: {
  emoji: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <p className="text-[12px] font-medium text-muted-foreground">
        {emoji} {label}
      </p>
      <p className="mt-1 text-[22px] font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-emerald-600">{hint}</p> : null}
    </div>
  );
}

function TimelinePanel({ events }: { events: CampaignTimelineEvent[] }) {
  return (
    <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <span>🕐</span> Timeline
      </h3>
      <ol className="mt-4 space-y-4">
        {events.map((event, idx) => (
          <li key={idx} className="relative pl-8">
            {idx < events.length - 1 ? (
              <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
            ) : null}
            <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[12px]">
              {event.emoji}
            </span>
            <p className="text-[13px] font-semibold text-foreground">{event.label}</p>
            <p className="text-[11px] text-muted-foreground">{formatCampaignDateTime(event.at)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{event.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CostBreakdown({
  sent,
  segments,
  cost,
}: {
  sent: number;
  segments: number;
  cost: number;
}) {
  return (
    <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <span>💰</span> Cost breakdown
      </h3>
      <dl className="mt-4 space-y-3 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Messages sent</dt>
          <dd className="font-medium tabular-nums">{formatNumber(sent)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Segments per message</dt>
          <dd className="font-medium tabular-nums">{segments}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Rate per segment</dt>
          <dd className="font-medium">$0.015</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-3">
          <dt className="font-semibold text-foreground">Total cost</dt>
          <dd className="text-[16px] font-bold tabular-nums">{formatCurrency(cost)}</dd>
        </div>
      </dl>
    </section>
  );
}

function MessagePreview({ body }: { body?: string }) {
  return (
    <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <span>📱</span> Message preview
      </h3>
      <div className="mt-4 mx-auto w-full max-w-[260px] rounded-[24px] border-[6px] border-slate-800 bg-slate-900 p-3 shadow-lg">
        <div className="min-h-[160px] rounded-[16px] bg-slate-50 px-3 py-4">
          {body ? (
            <div className="ml-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-[13px] leading-relaxed text-white">
              {body}
            </div>
          ) : (
            <p className="py-6 text-center text-[12px] text-muted-foreground">No message on file.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function matchesRecipientFilter(status: string, filter: string): boolean {
  const s = status.toLowerCase();
  if (filter === "All") return true;
  if (filter === "Delivered") return s.includes("delivered");
  if (filter === "Failed") return s.includes("failed");
  if (filter === "Clicked") return s.includes("click");
  if (filter === "Replied") return s.includes("repl");
  if (filter === "Opt-Outs") return s.includes("opt");
  return s.includes(filter.toLowerCase().replace(/-/g, ""));
}

export function CampaignResultsView({
  campaign,
  recipients = [],
  timeline: timelineProp,
  segmentsPerMessage = 1,
  cost = 0,
}: {
  campaign: CampaignStats;
  recipients?: RecipientRow[];
  timeline: CampaignTimelineEvent[];
  segmentsPerMessage?: number;
  cost?: number;
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
        // ignore
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
      rows = rows.filter((r) => matchesRecipientFilter(r.status, recipientFilter));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q));
    }
    return rows;
  }, [recipients, recipientFilter, search]);

  return (
    <div className="mx-auto max-w-[1200px] px-1 pb-10">
      <V1Breadcrumb items={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]} />

      <V1PageHeader
        emoji={campaignStatusEmoji(campaign.status)}
        title={campaign.name}
        description={campaign.audience || "Campaign results"}
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline">← Back</Button>
            </Link>
            <Link href={`/campaigns/new?duplicate=${campaign.id}`}>
              <Button variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            </Link>
            <CampaignActions
              campaignId={campaign.id}
              status={campaign.status}
              isMassText={campaignLooksLikeMassText(campaign.configJson)}
            />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={campaign.status} />
        {isSending ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-700">
            📤 Live updating…
          </span>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard emoji="📤" label="Sent" value={formatNumber(live.sent)} />
        <KpiCard emoji="✅" label="Delivered" value={formatNumber(live.delivered)} hint={formatPercent(deliveryRate)} />
        <KpiCard emoji="⏳" label="Pending" value={formatNumber(pending)} />
        <KpiCard emoji="👆" label="Clicks" value={formatNumber(live.clicks)} hint={formatPercent(clickRate)} />
        <KpiCard emoji="💬" label="Replies" value={formatNumber(live.replies)} hint={formatPercent(replyRate)} />
        <KpiCard emoji="🚫" label="Opt-outs" value={formatNumber(live.optOuts)} hint={formatPercent(optOutRate)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {RESULT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition",
              tab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[15px] font-semibold text-foreground">📈 Delivery</h3>
                <div className="mt-4 flex items-center gap-6">
                  <div
                    className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-emerald-500"
                    style={{
                      borderRightColor: pending > 0 ? "#e5e7eb" : undefined,
                      borderBottomColor: pending > 0 ? "#fef3c7" : undefined,
                    }}
                  >
                    <span className="text-[18px] font-bold tabular-nums">{formatPercent(deliveryRate, 0)}</span>
                  </div>
                  <ul className="space-y-2 text-[13px]">
                    <li className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Delivered {formatNumber(live.delivered)}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      Pending {formatNumber(pending)}
                    </li>
                  </ul>
                </div>
              </section>

              <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[15px] font-semibold text-foreground">📊 Engagement</h3>
                <div className="mt-6 flex h-32 items-end gap-2">
                  {[
                    { label: "Clicks", value: live.clicks, color: "bg-indigo-500" },
                    { label: "Replies", value: live.replies, color: "bg-violet-500" },
                    { label: "Opt-outs", value: live.optOuts, color: "bg-orange-400" },
                  ].map((bar) => (
                    <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cn("w-full rounded-t-md", bar.color)}
                        style={{ height: `${Math.max(12, Math.min(100, bar.value * 6))}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <span>📊</span> Summary
              </h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Audience", value: campaign.audience || "—" },
                  { label: "Status", value: campaign.status },
                  { label: "Scheduled", value: formatCampaignDateTime(campaign.scheduledAt ?? null) },
                  { label: "Total cost", value: formatCurrency(cost) },
                ].map((row) => (
                  <div key={row.label} className="rounded-[10px] bg-muted/30 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="mt-1 text-[13px] font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <div className="space-y-6">
            <MessagePreview body={campaign.body} />
            <TimelinePanel events={timelineProp} />
            <CostBreakdown sent={live.sent} segments={segmentsPerMessage} cost={cost} />
          </div>
        </div>
      ) : null}

      {tab === "recipients" ? (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {RECIPIENT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setRecipientFilter(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                  recipientFilter === f ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
            <table className="w-full min-w-[800px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Clicked</th>
                  <th className="px-4 py-3">Replied</th>
                  <th className="px-4 py-3">Opt-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No recipients to show yet.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.phone}</td>
                      <td className="px-4 py-3">
                        <RecipientStatus status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.failureReason || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTs(r.deliveredAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTs(r.clickedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTs(r.repliedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTs(r.optedOutAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab !== "overview" && tab !== "recipients" ? (
        <div className="mt-4 rounded-[14px] border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-foreground">
            {RESULT_TABS.find((t) => t.id === tab)?.emoji}{" "}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Detailed {tab} data appears as engagement is recorded.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RecipientStatus({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes("deliver") || s.includes("sent")
      ? "bg-emerald-50 text-emerald-700"
      : s.includes("fail")
        ? "bg-red-50 text-red-700"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {status}
    </span>
  );
}
