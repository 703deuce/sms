"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Send,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import type { CampaignRow } from "@/components/reputation/review-requests-campaigns";
import { CampaignCreateWizard } from "@/components/reputation/campaign-create-wizard";
import {
  RepBadge,
  RepPageHeader,
  RepSearch,
  rep,
} from "@/components/reputation/rep-ui";
import { cn } from "@/lib/utils";

type OverrideStats = {
  activeCampaigns: number;
  pausedCampaigns?: number;
  totalCampaigns?: number;
  messagesSent30d: number;
  messagesSentTrend?: number;
  reviewsGenerated30d: number;
  reviewsTrend?: number;
  conversion: number;
  conversionTrend?: number;
  costPerReview: number;
  costTrend?: number;
};

type ActivityItem = {
  id: string;
  type: "reviews_detected" | "sms_sent" | "review_received" | "campaign_paused";
  label: string;
  detail: string;
  relativeTime: string;
};

export type ReviewCampaignsPreviewData = {
  campaigns: CampaignRow[];
  stats?: OverrideStats;
  activity?: ActivityItem[];
};

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function statusTone(status: string): "green" | "blue" | "amber" | "red" | "gray" {
  if (status === "active") return "green";
  if (status === "scheduled") return "blue";
  if (status === "paused") return "amber";
  if (status === "draft" || status === "incomplete") return "gray";
  if (status === "failed" || status === "cancelled") return "red";
  return "gray";
}

function statusLabel(status: string): string {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function nextStepLabel(campaign: CampaignRow): string {
  if (campaign.next_step_label) return campaign.next_step_label;
  if (campaign.status === "draft" || campaign.status === "incomplete") return "Finish setup";
  if (campaign.status === "paused") return "Resume enrollment";
  if (campaign.status === "scheduled") return "Starts soon";
  if (campaign.queued > 0) return `${campaign.queued} queued`;
  if (campaign.status === "active") return "Monitor performance";
  if (campaign.status === "completed") return "Review results";
  return "No action";
}

function TrendBadge({
  value,
  inverseBetter = false,
}: {
  value: number | undefined;
  inverseBetter?: boolean;
}) {
  if (value == null) return null;
  const isPositive = inverseBetter ? value <= 0 : value >= 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-semibold", isPositive ? "text-[#027A48]" : "text-[#B42318]")}>
      {inverseBetter ? (
        value <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />
      ) : (
        value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
      )}
      {value >= 0 ? "+" : "−"}{Math.abs(value)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  inverseBetter = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: number;
  inverseBetter?: boolean;
}) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className={rep.label}>{label}</p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">{value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <TrendBadge value={trend} inverseBetter={inverseBetter} />
        {hint ? <p className="text-xs text-[#667085]">{hint}</p> : null}
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5 text-[#175CD3]" />;
  return <MessageSquare className="h-3.5 w-3.5 text-[#027A48]" />;
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "reviews_detected") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3]">
        <Star className="h-3.5 w-3.5 text-[#137752]" />
      </span>
    );
  }
  if (type === "sms_sent") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EFF8FF]">
        <Send className="h-3.5 w-3.5 text-[#175CD3]" />
      </span>
    );
  }
  if (type === "review_received") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFAEB]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#B54708]" />
      </span>
    );
  }
  if (type === "campaign_paused") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F4F7]">
        <Pause className="h-3.5 w-3.5 text-[#667085]" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F4F7]">
      <Activity className="h-3.5 w-3.5 text-[#667085]" />
    </span>
  );
}

function CampaignPerformance({
  campaigns,
  onViewAll,
}: {
  campaigns: CampaignRow[];
  onViewAll: () => void;
}) {
  const sent = campaigns.reduce((sum, c) => sum + (c.sent ?? 0), 0);
  const delivered = campaigns.reduce((sum, c) => sum + (c.delivered ?? c.sent ?? 0), 0);
  const clicked = campaigns.reduce((sum, c) => sum + (c.clicked ?? 0), 0);
  const reviews = campaigns.reduce((sum, c) => sum + (c.reviews_detected ?? 0), 0);
  const maxSent = Math.max(...campaigns.map((c) => c.sent ?? 0), 1);

  return (
    <section className={cn(rep.card, "p-4")}>
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#137752]" />
        <h2 className="text-[15px] font-semibold text-[#101828]">Campaign Performance (30 Days)</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <p className={rep.label}>Delivery</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(delivered, sent)}</p>
        </div>
        <div>
          <p className={rep.label}>Click Rate</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(clicked, delivered || sent)}</p>
        </div>
        <div>
          <p className={rep.label}>Reviews</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{fmt(reviews)}</p>
        </div>
        <div>
          <p className={rep.label}>Conversion</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(reviews, sent)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {campaigns
          .filter((c) => (c.sent ?? 0) > 0)
          .slice(0, 5)
          .map((c) => (
            <div key={c.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#344054]">{c.name}</span>
                <span className="text-xs font-bold tabular-nums text-[#101828]">{fmt(c.sent)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                <div
                  className="h-full rounded-full bg-[#137752]"
                  style={{ width: `${Math.max(4, ((c.sent ?? 0) / maxSent) * 100)}%` }}
                />
              </div>
            </div>
          ))}
      </div>
      <div className="mt-4 text-right">
        <button type="button" className={rep.link} onClick={onViewAll}>
          View all campaigns →
        </button>
      </div>
    </section>
  );
}

function RecentActivity({ previewActivity, campaigns }: { previewActivity?: ActivityItem[]; campaigns: CampaignRow[] }) {
  const activity = previewActivity ?? campaigns
    .flatMap((c) => [
      {
        id: `${c.id}-created`,
        type: "sms_sent" as ActivityItem["type"],
        label: `${c.name} created`,
        detail: `${fmt(c.recipients_ready)} eligible recipients`,
        relativeTime: formatDate(c.created_at),
      },
      (c.sent ?? 0) > 0
        ? {
            id: `${c.id}-sent`,
            type: "sms_sent" as ActivityItem["type"],
            label: `${c.name} — ${fmt(c.sent)} messages sent`,
            detail: `${fmt(c.clicked)} clicks · ${fmt(c.reviews_detected)} reviews`,
            relativeTime: formatDate(c.created_at),
          }
        : null,
    ])
    .filter((item): item is ActivityItem => Boolean(item))
    .slice(0, 6);

  return (
    <section className={cn(rep.card, "p-4")}>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#137752]" />
        <h2 className="text-[15px] font-semibold text-[#101828]">Recent Activity</h2>
      </div>
      {activity.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#667085]">No campaign activity yet.</p>
      ) : (
        <ol className="space-y-4">
          {activity.map((item) => (
            <li key={item.id} className="flex gap-3">
              <ActivityIcon type={item.type} />
              <span className="min-w-0 pt-0.5">
                <span className="block text-sm font-semibold text-[#101828]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#667085]">
                  {item.detail} · {item.relativeTime}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReviewCampaignsHub({
  businessId,
  overrideStats,
  previewActivity,
  previewData,
}: {
  businessId: string;
  overrideStats?: OverrideStats;
  previewActivity?: ActivityItem[];
  previewData?: ReviewCampaignsPreviewData;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(previewData?.campaigns ?? []);
  const [loading, setLoading] = useState(!previewData?.campaigns);
  const [showWizard, setShowWizard] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewData?.campaigns) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation/review-requests/campaigns?businessId=${businessId}`);
      const json = await res.json();
      if (res.ok) setCampaigns(json.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, [businessId, previewData?.campaigns]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const computedStats = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active" || c.status === "scheduled").length;
    const paused = campaigns.filter((c) => c.status === "paused").length;
    const sent = campaigns.reduce((n, c) => n + (c.sent ?? 0), 0);
    const reviews = campaigns.reduce((n, c) => n + (c.reviews_detected ?? 0), 0);
    return {
      activeCampaigns: active,
      pausedCampaigns: paused,
      totalCampaigns: campaigns.length,
      messagesSent30d: sent,
      messagesSentTrend: undefined as number | undefined,
      reviewsGenerated30d: reviews,
      reviewsTrend: undefined as number | undefined,
      conversion: sent > 0 ? Math.round((reviews / sent) * 1000) / 10 : 0,
      conversionTrend: undefined as number | undefined,
      costPerReview: 0,
      costTrend: undefined as number | undefined,
    };
  }, [campaigns]);

  const stats = previewData?.stats ?? overrideStats ?? computedStats;
  const activity = previewData?.activity ?? previewActivity;

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (channelFilter !== "all" && c.channel !== channelFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!c.name.toLowerCase().includes(q) && !c.status.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [campaigns, channelFilter, search, statusFilter]
  );

  async function campaignAction(campaignId: string, act: string) {
    setMenuId(null);
    setActionError(null);
    const res = await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof json.error === "string" ? json.error : `Failed to ${act} campaign`);
      return;
    }
    await load();
  }

  async function duplicateCampaign(campaignId: string) {
    setMenuId(null);
    setActionError(null);
    const res = await fetch("/api/reputation/review-requests/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, duplicateFrom: campaignId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof json.error === "string" ? json.error : "Failed to duplicate campaign");
      return;
    }
    await load();
  }

  return (
    <ModulePage className={rep.page}>
      <RepPageHeader
        title="Campaigns"
        subtitle="Build automated sequences to get more reviews."
        showFilters={false}
        actions={
          <Link href={`/businesses/${businessId}/reputation/templates`} className={rep.btnSecondary}>
            <FileText className="h-4 w-4" />
            Templates
          </Link>
        }
        primaryAction={
          <button type="button" onClick={() => setShowWizard((s) => !s)} className={rep.btnPrimary}>
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Active Campaigns"
          value={loading ? "—" : fmt(stats.activeCampaigns)}
          hint={stats.pausedCampaigns ? `${stats.pausedCampaigns} paused` : "Active or scheduled"}
          icon={Users}
          iconBg="#ECFDF3"
          iconColor="#137752"
        />
        <KpiCard
          label="Messages Sent (30d)"
          value={loading ? "—" : fmt(stats.messagesSent30d)}
          hint="vs prior 30 days"
          trend={stats.messagesSentTrend}
          icon={Send}
          iconBg="#EFF8FF"
          iconColor="#175CD3"
        />
        <KpiCard
          label="Reviews Generated (30d)"
          value={loading ? "—" : fmt(stats.reviewsGenerated30d)}
          hint="Likely or confirmed"
          trend={stats.reviewsTrend}
          icon={Star}
          iconBg="#FFFAEB"
          iconColor="#B54708"
        />
        <KpiCard
          label="Conversion Rate"
          value={loading ? "—" : `${stats.conversion}%`}
          hint="Reviews / messages"
          trend={stats.conversionTrend}
          icon={BarChart3}
          iconBg="#F4F3FF"
          iconColor="#5925DC"
        />
        <KpiCard
          label="Cost Per Review"
          value={loading ? "—" : stats.costPerReview > 0 ? `$${stats.costPerReview}` : "—"}
          hint={stats.costPerReview > 0 ? "Improving" : "Cost data unavailable"}
          trend={stats.costTrend}
          inverseBetter
          icon={DollarSign}
          iconBg="#ECFDF3"
          iconColor="#137752"
        />
      </div>

      {showWizard ? (
        <div className={cn(rep.card, "p-4")}>
          <CampaignCreateWizard
            businessId={businessId}
            onCancel={() => setShowWizard(false)}
            onComplete={(campaignId) => {
              setShowWizard(false);
              void load();
              if (campaignId) {
                router.push(`/businesses/${businessId}/reputation/campaigns/${campaignId}`);
              }
            }}
          />
        </div>
      ) : null}

      {/* Campaigns table */}
      <section id="campaigns-table" className={cn(rep.card, "overflow-hidden")}>
        <div className="border-b border-[#E6EAF0] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#101828]">Your Campaigns</h2>
              <p className="mt-0.5 text-xs text-[#667085]">
                {loading ? "Loading..." : `${campaigns.length} campaigns · ${stats.activeCampaigns} active`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={rep.select}>
                <option value="all">All Statuses</option>
                {Array.from(new Set(campaigns.map((c) => c.status))).map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={rep.select}>
                <option value="all">All Channels</option>
                {Array.from(new Set(campaigns.map((c) => c.channel))).map((ch) => (
                  <option key={ch} value={ch} className="capitalize">{ch}</option>
                ))}
              </select>
              <RepSearch value={search} onChange={setSearch} placeholder="Search campaigns..." className="min-w-[200px]" />
            </div>
          </div>
        </div>

        {actionError ? (
          <div className="border-b border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{actionError}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                <th className="px-4 py-2 font-semibold">Campaign</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Channel</th>
                <th className="px-4 py-2 text-right font-semibold">Enrolled</th>
                <th className="px-4 py-2 font-semibold">Messages Sent</th>
                <th className="px-4 py-2 text-right font-semibold">Reviews</th>
                <th className="px-4 py-2 text-right font-semibold">Conversion</th>
                <th className="px-4 py-2 font-semibold">Next Step</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#667085]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#667085]">
                    No campaigns match these filters.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const sentProgress = c.recipients_ready > 0
                    ? Math.min(100, Math.round(((c.sent ?? 0) / c.recipients_ready) * 100))
                    : 0;
                  const convRate = c.conversion_rate != null
                    ? `${c.conversion_rate}%`
                    : c.sent
                    ? pct(c.reviews_detected ?? 0, c.sent)
                    : "—";
                  const isDraft = c.status === "draft" || c.status === "incomplete";

                  return (
                    <tr key={c.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/businesses/${businessId}/reputation/campaigns/${c.id}`}
                          className="font-semibold text-[#101828] hover:text-[#137752] hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-[#667085]">Created {formatDate(c.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RepBadge tone={statusTone(c.status)}>{statusLabel(c.status)}</RepBadge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 capitalize text-[#344054]">
                          <ChannelIcon channel={c.channel} />
                          {c.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#344054]">
                        {isDraft ? "—" : fmt(c.recipients_ready)}
                      </td>
                      <td className="px-4 py-3">
                        {isDraft ? (
                          <span className="text-[#98A2B3]">—</span>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold tabular-nums text-[#101828]">{fmt(c.sent)}</span>
                              <span className="text-xs text-[#667085]">{sentProgress}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
                              <div
                                className="h-full rounded-full bg-[#137752]"
                                style={{ width: `${Math.max(2, sentProgress)}%` }}
                              />
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#344054]">
                        {isDraft ? "—" : fmt(c.reviews_detected)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#101828]">
                        {isDraft ? "—" : convRate}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-sm",
                          c.status === "active" ? "text-[#027A48]" : "text-[#667085]"
                        )}>
                          {nextStepLabel(c)}
                        </span>
                      </td>
                      <td className="relative px-4 py-3">
                        <button
                          type="button"
                          className={rep.btnSecondary}
                          style={{ padding: "0.375rem 0.5rem", height: "auto" }}
                          onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === c.id ? (
                          <div className="absolute right-4 z-10 mt-1 w-40 rounded-lg border border-[#E6EAF0] bg-white py-1 shadow-lg">
                            <Link
                              href={`/businesses/${businessId}/reputation/campaigns/${c.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-[#344054] hover:bg-[#F9FAFB]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </Link>
                            {c.status === "active" ? (
                              <button type="button" onClick={() => void campaignAction(c.id, "pause")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Pause className="h-3.5 w-3.5" />
                                Pause
                              </button>
                            ) : null}
                            {c.status === "paused" ? (
                              <button type="button" onClick={() => void campaignAction(c.id, "resume")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Play className="h-3.5 w-3.5" />
                                Resume
                              </button>
                            ) : null}
                            {c.status === "draft" ? (
                              <button type="button" onClick={() => void campaignAction(c.id, "start")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Play className="h-3.5 w-3.5" />
                                Start
                              </button>
                            ) : null}
                            <button type="button" onClick={() => void duplicateCampaign(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            {!["completed", "cancelled", "archived"].includes(c.status) ? (
                              <button type="button" onClick={() => void campaignAction(c.id, "cancel")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#B42318] hover:bg-[#FEF3F2]">
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CampaignPerformance
          campaigns={campaigns}
          onViewAll={() => {
            document.getElementById("campaigns-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <RecentActivity previewActivity={activity} campaigns={campaigns} />
      </div>
    </ModulePage>
  );
}
