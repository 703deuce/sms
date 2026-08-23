"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock,
  Flame,
  Table2,
  TrendingUp,
} from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { RepAreaTrendChart, RepVolumeBarChart } from "@/components/reputation/rep-charts";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import {
  aggregateReviewAnalyticsTimeline,
  type GroupMode,
  type ReviewAnalyticsData,
  type RollingPeriodMetric,
} from "@/lib/reviews/review-analytics-data";
import { cn } from "@/lib/utils";

const GREEN = "#137752";
const BLUE = "#3B82F6";
const PURPLE = "#8B5CF6";

type TabId = "timeline" | "velocity" | "momentum";

export type MomentumFactor = {
  label: string;
  strength: "Very Strong" | "Strong" | "Moderate" | "Weak";
};

export type ReviewAnalyticsDashboardData = ReviewAnalyticsData & {
  totalReviews?: number;
  dateRangeLabel?: string;
  momentumScore?: number;
  momentumFactors?: MomentumFactor[];
  avgDaysBetweenDelta?: number;
  periodRows?: Array<{
    label: string;
    reviews: number;
    previous: number;
    delta: number;
    deltaPct: number | null;
  }>;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "velocity", label: "Velocity" },
  { id: "momentum", label: "Momentum" },
];

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function signed(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value), suffix)}`;
}

function pctTrend(periods: RollingPeriodMetric[], days: 7 | 30 | 60 | 90): string | undefined {
  const p = periods.find((r) => r.days === days);
  if (!p || p.deltaPct == null) return undefined;
  return `${p.deltaPct >= 0 ? "▲" : "▼"}${Math.abs(Math.round(p.deltaPct))}%`;
}

function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#101828]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PeriodTable({ rows }: { rows: NonNullable<ReviewAnalyticsDashboardData["periodRows"]> }) {
  return (
    <Card title="Reviews by Period" subtitle="Current period compared with the previous matching window.">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
            <tr>
              <th className="px-3 py-2 font-semibold">Period</th>
              <th className="px-3 py-2 font-semibold">Reviews</th>
              <th className="px-3 py-2 font-semibold">Previous</th>
              <th className="px-3 py-2 font-semibold">Delta</th>
              <th className="px-3 py-2 font-semibold">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-[#F2F4F7]">
                <td className="px-3 py-3 font-medium text-[#101828]">{row.label}</td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{row.reviews}</td>
                <td className="px-3 py-3 tabular-nums text-[#667085]">{row.previous}</td>
                <td className={cn("px-3 py-3 tabular-nums font-semibold", row.delta >= 0 ? "text-[#027A48]" : "text-[#B42318]")}>
                  {signed(row.delta)}
                </td>
                <td className="px-3 py-3 tabular-nums text-[#667085]">
                  {row.deltaPct == null ? "—" : `${row.deltaPct >= 0 ? "▲" : "▼"}${Math.abs(Math.round(row.deltaPct))}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const STRENGTH_DOT: Record<MomentumFactor["strength"], string> = {
  "Very Strong": "#137752",
  Strong: "#3B82F6",
  Moderate: "#F79009",
  Weak: "#EF4444",
};

function MomentumFactorsList({ factors }: { factors: MomentumFactor[] }) {
  return (
    <div className="space-y-2">
      {factors.map((factor) => (
        <div
          key={factor.label}
          className="flex items-center justify-between rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: STRENGTH_DOT[factor.strength] }}
            />
            <span className="text-sm font-medium text-[#344054]">{factor.label}</span>
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: STRENGTH_DOT[factor.strength] }}
          >
            {factor.strength}
          </span>
        </div>
      ))}
    </div>
  );
}

function VelocitySnapshot({ data }: { data: ReviewAnalyticsDashboardData }) {
  const weeklyDeltaPct = data.priorPeriod.weeklyVelocityDelta > 0
    ? Math.round((data.priorPeriod.weeklyVelocityDelta / (data.weeklyVelocity - data.priorPeriod.weeklyVelocityDelta)) * 100)
    : null;
  const monthlyDeltaPct = data.priorPeriod.monthlyVelocityDelta > 0
    ? Math.round((data.priorPeriod.monthlyVelocityDelta / (data.monthlyVelocity - data.priorPeriod.monthlyVelocityDelta)) * 100)
    : null;
  const activeWeeks = Math.round(data.activeStreakDays / 7);

  return (
    <Card title="Review Velocity (30 Days)" subtitle="How consistently new reviews are arriving.">
      <div className="space-y-3">
        {/* Weekly velocity big */}
        <div className="rounded-xl bg-[#ECFDF3] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#027A48]">
            Weekly Velocity
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-[#101828]">
              {fmt(data.weeklyVelocity)}
            </p>
            <span className="text-sm text-[#667085]">reviews/week</span>
            {weeklyDeltaPct != null ? (
              <span className="ml-auto rounded-full bg-[#D1FAE5] px-2 py-0.5 text-xs font-bold text-[#027A48]">
                ▲{weeklyDeltaPct}%
              </span>
            ) : null}
          </div>
        </div>

        {/* Monthly velocity */}
        <div className="flex items-center justify-between rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Monthly</p>
            <p className="mt-0.5 text-xl font-bold text-[#101828]">{fmt(data.monthlyVelocity)}</p>
            <p className="text-xs text-[#667085]">reviews/month</p>
          </div>
          {monthlyDeltaPct != null ? (
            <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-xs font-bold text-[#027A48]">
              ▲{monthlyDeltaPct}%
            </span>
          ) : null}
        </div>

        <dl className="space-y-2">
          {[
            ["Median days between", fmt(data.medianDaysBetweenReviews, " d")],
            ["Longest drought", fmt(data.longestDroughtDays, " d")],
            ["Active weeks", activeWeeks > 0 ? `${activeWeeks} wks` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-[#667085]">{label}</dt>
              <dd className="font-semibold tabular-nums text-[#101828]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

    </Card>
  );
}

function MomentumCard({ data }: { data: ReviewAnalyticsDashboardData }) {
  const score = data.momentumScore ?? Math.max(0, Math.min(100, Math.round((data.accelerationPct ?? 0) + 65)));
  const factors = data.momentumFactors;

  return (
    <Card title="Momentum" subtitle="Signals behind the current review growth trend.">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <RepBadge tone={data.momentumStatus === "Accelerating" ? "green" : data.momentumStatus === "Slowing" ? "amber" : "gray"}>
            {data.momentumStatus}
          </RepBadge>
          <p className="mt-3 text-4xl font-bold tracking-tight text-[#101828]">{score}/100</p>
          <p className="mt-1 text-sm text-[#667085]">{data.explanation}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <Flame className="h-6 w-6" />
        </span>
      </div>

      <div className="mt-4">
        {factors ? (
          <MomentumFactorsList factors={factors} />
        ) : (
          <div className="space-y-2">
            {data.drivers.map((driver) => (
              <div key={driver} className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                {driver}
              </div>
            ))}
          </div>
        )}
      </div>

    </Card>
  );
}

function GreenAlertBar({ rolling30d, rolling30dDelta, rolling30dDeltaPct }: {
  rolling30d: number;
  rolling30dDelta: number;
  rolling30dDeltaPct: number | null;
}) {
  if (rolling30dDelta <= 0 || rolling30dDeltaPct == null) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3">
      <p className="text-sm font-medium text-[#027A48]">
        You&apos;ve gained{" "}
        <span className="font-bold">{rolling30d} reviews</span> in the last 30 days. This is{" "}
        <span className="font-bold">{Math.round(rolling30dDeltaPct)}% more</span> than the
        previous 30 days.
      </p>
    </div>
  );
}

export function ReviewAnalyticsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewAnalyticsDashboardData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [groupMode, setGroupMode] = useState<GroupMode>("daily");

  const periodRows = useMemo(
    () =>
      data.periodRows ??
      data.rollingPeriods.map((period) => ({
        label: `${period.days} days`,
        reviews: period.current,
        previous: period.previous,
        delta: period.delta,
        deltaPct: period.deltaPct,
      })),
    [data.periodRows, data.rollingPeriods]
  );

  const chartData = useMemo(() => {
    const aggregated = aggregateReviewAnalyticsTimeline(data.timelinePoints, groupMode);
    const firstCompetitor = data.competitors[0]?.id;
    const secondCompetitor = data.competitors[1]?.id;
    return aggregated.map((point) => ({
      ...point,
      topCompetitor:
        (firstCompetitor ? point.competitorSeries?.[firstCompetitor] : undefined) ??
        point.competitorAvg ??
        0,
      secondCompetitor:
        (secondCompetitor ? point.competitorSeries?.[secondCompetitor] : undefined) ??
        Math.max(0, Math.round((point.competitorAvg ?? 0) * 0.75)),
    }));
  }, [data.competitors, data.timelinePoints, groupMode]);

  const dailyVolume = useMemo(
    () =>
      data.timelinePoints.slice(-30).map((point) => ({
        date: point.date.slice(5),
        reviews: point.you,
      })),
    [data.timelinePoints]
  );

  const totalReviews = data.totalReviews ?? data.timelinePoints.reduce((sum, point) => sum + point.you, 0);
  const events = chartData.filter((point) => point.events.length > 0);
  const topCompetitorName = data.competitors[0]?.name ?? "Top Competitor";
  const secondCompetitorName = data.competitors[1]?.name ?? "2nd Competitor";
  const hasTimeline = chartData.some((point) => point.you > 0 || point.topCompetitor > 0 || point.secondCompetitor > 0);

  const rolling30dPeriod = data.rollingPeriods.find((p) => p.days === 30);
  const rolling30dDeltaPct = rolling30dPeriod?.deltaPct ?? null;
  const totalDelta = data.priorPeriod.rolling30dDelta;

  const kpis = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <RepMetricCard
        label="Total Reviews"
        value={fmt(totalReviews)}
        trend={totalDelta != null ? signed(totalDelta) : undefined}
        hint="vs prior 30d"
        trendPositive={(totalDelta ?? 0) >= 0}
      />
      <RepMetricCard
        label="Reviews 7d"
        value={fmt(data.rolling7d)}
        trend={pctTrend(data.rollingPeriods, 7)}
        hint="vs previous 7d"
        trendPositive={(data.rollingPeriods.find((p) => p.days === 7)?.delta ?? 0) >= 0}
      />
      <RepMetricCard
        label="Reviews 30d"
        value={fmt(data.rolling30d)}
        trend={pctTrend(data.rollingPeriods, 30)}
        hint="vs previous 30d"
        trendPositive={(data.rollingPeriods.find((p) => p.days === 30)?.delta ?? 0) >= 0}
      />
      <RepMetricCard
        label="Reviews 60d"
        value={fmt(data.rolling60d)}
        trend={pctTrend(data.rollingPeriods, 60)}
        hint="vs previous 60d"
        trendPositive={(data.rollingPeriods.find((p) => p.days === 60)?.delta ?? 0) >= 0}
      />
      <RepMetricCard
        label="Reviews 90d"
        value={fmt(data.rolling90d)}
        trend={pctTrend(data.rollingPeriods, 90)}
        hint="vs previous 90d"
        trendPositive={(data.rollingPeriods.find((p) => p.days === 90)?.delta ?? 0) >= 0}
      />
      <RepMetricCard
        label="Avg Days Between"
        value={fmt(data.avgDaysBetweenReviews)}
        trend={
          data.avgDaysBetweenDelta != null
            ? `${data.avgDaysBetweenDelta >= 0 ? "▲" : "▼"}${fmt(Math.abs(data.avgDaysBetweenDelta))}`
            : undefined
        }
        hint={`Median ${fmt(data.medianDaysBetweenReviews)} d`}
        trendPositive={(data.avgDaysBetweenDelta ?? 0) < 0}
      />
    </div>
  );

  const timelineChart = (
    <Card
      title="Reviews Over Time"
      subtitle="You vs competitor review velocity with campaign and Maps scan markers."
      action={
        <div className="flex rounded-lg bg-[#F2F4F7] p-1">
          {(["daily", "weekly", "monthly"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                groupMode === mode ? "bg-white text-[#137752] shadow-sm" : "text-[#667085]"
              )}
            >
              {mode === "daily" ? "Day" : mode === "weekly" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      }
    >
      {hasTimeline ? (
        <RepAreaTrendChart
          data={chartData}
          height={380}
          markers={events.map((point) => ({
            x: point.date,
            label: point.events[0]?.label ?? "",
            color: point.events.some((event) => event.type === "campaign_start") ? "#F79009" : "#8B5CF6",
          }))}
          series={[
            { dataKey: "you", name: "You", color: GREEN, strokeWidth: 3, fillOpacity: 0.26 },
            { dataKey: "topCompetitor", name: topCompetitorName, color: BLUE, strokeWidth: 2.4, fillOpacity: 0.12 },
            { dataKey: "secondCompetitor", name: secondCompetitorName, color: PURPLE, strokeWidth: 2.2, fillOpacity: 0.1 },
          ]}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-[#667085]">No review timeline yet. Refresh reputation data to populate charts.</p>
          <ReputationSyncButton businessId={businessId} />
        </div>
      )}
    </Card>
  );

  const volumeChart = (
    <Card title="Daily Review Volume" subtitle="Last 30 days">
      <RepVolumeBarChart data={dailyVolume} height={260} />
    </Card>
  );

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Review Analytics"
        subtitle="Track review growth, velocity, and momentum over time."
        dateRangeLabel={data.dateRangeLabel ?? "Last 90 days"}
        showCompare={false}
        showExport={false}
        showFilters={false}
        primaryAction={<ReputationSyncButton businessId={businessId} variant="secondary" label="Refresh Data" />}
      />

      <RepTabs tabs={tabs} active={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />

      {activeTab === "timeline" ? (
        <>
          {kpis}
          {timelineChart}
          <GreenAlertBar
            rolling30d={data.rolling30d}
            rolling30dDelta={data.priorPeriod.rolling30dDelta}
            rolling30dDeltaPct={rolling30dDeltaPct}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <VelocitySnapshot data={data} />
            <MomentumCard data={data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PeriodTable rows={periodRows} />
            {volumeChart}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#667085]">
            <Clock className="mt-0.5 h-3.5 w-3.5" />
            Review timestamps are normalized to {data.timezone}. Campaign and Maps markers reflect observed event dates.
          </div>
        </>
      ) : null}

      {activeTab === "velocity" ? (
        <>
          {kpis}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {volumeChart}
            <VelocitySnapshot data={data} />
          </div>
          <PeriodTable rows={periodRows} />
        </>
      ) : null}

      {activeTab === "momentum" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <MomentumCard data={data} />
          <Card title="Momentum Factors" subtitle="Signals contributing to the current score.">
            {data.momentumFactors ? (
              <MomentumFactorsList factors={data.momentumFactors} />
            ) : (
              <div className="space-y-3">
                {data.drivers.map((driver) => (
                  <div key={driver} className="flex items-start gap-3 rounded-xl border border-[#E6EAF0] bg-white p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <p className="text-sm leading-6 text-[#344054]">{driver}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-[#F9FAFB] p-4 text-sm leading-6 text-[#667085]">
                  {data.competitorRelative}
                </div>
              </div>
            )}
          </Card>
          <Card title="Reviews by Period" className="xl:col-span-2">
            <div className="flex items-center gap-2 text-sm text-[#667085]">
              <Table2 className="h-4 w-4 text-[#137752]" />
              Use the Timeline tab for the full period table and daily volume chart.
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
