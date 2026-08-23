"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Camera,
  FileText,
  MessageSquareText,
  RefreshCw,
  Search,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  ModulePage,
  moduleStack,
} from "@/components/ui/design-system";
import {
  REP_GREEN,
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { RepAreaTrendChart } from "@/components/reputation/rep-charts";
import {
  ReputationEmptySyncState,
  ReputationSyncButton,
} from "@/components/reputation/reputation-sync-button";
import { cn } from "@/lib/utils";
import type { ReviewInsightsData, ReviewInsightTheme } from "@/lib/reviews/review-insights-data";

type TabId = "themes" | "keywords" | "performance" | "quality";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "themes", label: "Themes" },
  { id: "keywords", label: "Services & Keywords" },
  { id: "performance", label: "Response Performance" },
  { id: "quality", label: "Response Quality" },
];

function formatNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function Card({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn(rep.card, "overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-[#E6EAF0] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-[#667085]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ThemePanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: ReviewInsightTheme[];
  tone: "positive" | "negative";
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const bar = tone === "positive" ? "bg-[#137752]" : "bg-[#D92D20]";
  const text = tone === "positive" ? "text-[#027A48]" : "text-[#B42318]";

  return (
    <Card title={title}>
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="py-8 text-center text-sm text-[#667085]">No matching themes yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#344054]">{item.label}</span>
                <span className={cn("shrink-0 text-xs font-bold tabular-nums", text)}>
                  {item.count} ({item.pct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                <div
                  className={cn("h-full rounded-full", bar)}
                  style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function ServiceMentionList({
  items,
  empty,
  barColor = REP_GREEN,
}: {
  items: Array<{ label: string; count: number; pct: number }>;
  empty: string;
  barColor?: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-[#667085]">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-[#344054]">{item.label}</span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-[#101828]">
              {item.count} <span className="font-normal text-[#667085]">({item.pct}%)</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, item.pct)}%`, backgroundColor: barColor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MentionList({
  items,
  empty,
}: {
  items: Array<{ keyword: string; count: number }>;
  empty: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  if (!items.length) {
    return <p className="py-8 text-center text-sm text-[#667085]">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <li key={item.keyword}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold capitalize text-[#344054]">{item.keyword}</span>
            <span className="text-xs font-bold tabular-nums text-[#101828]">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full bg-[#137752]"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KeywordPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ keyword: string; count: number }>;
}) {
  return (
    <Card title={title}>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-[#667085]">No mentions found yet.</p>
        ) : (
          items.map((item) => (
            <span
              key={item.keyword}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-1 text-xs font-semibold capitalize text-[#344054]"
            >
              {item.keyword}
              <span className="text-[#98A2B3]">{item.count}</span>
            </span>
          ))
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <RepMetricCard label={label} value={value} hint={sub} />;
}

function BoolBadge({ value }: { value: boolean }) {
  return <RepBadge tone={value ? "green" : "gray"}>{value ? "Yes" : "No"}</RepBadge>;
}

export function ReviewInsightsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewInsightsData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("themes");
  const hasInsightData =
    data.metrics.totalReviewText > 0 ||
    data.themes.positive.length > 0 ||
    data.themes.negative.length > 0 ||
    data.servicesAndKeywords.length > 0 ||
    data.responseQuality.rows.length > 0;

  const responseBars = [
    { label: "Answered", count: data.responsePerformance.answered },
    { label: "Unanswered +", count: data.responsePerformance.unansweredPositive },
    { label: "Unanswered -", count: data.responsePerformance.unansweredNegative },
    { label: "Neutral", count: data.responsePerformance.unansweredNeutral },
  ];

  return (
    <ModulePage className={moduleStack}>
      <RepPageHeader
        title="Review Insights"
        subtitle="Discover what customers are saying and how you're responding."
        dateRangeLabel="Last 90 days"
        primaryAction={
          <ReputationSyncButton
            businessId={businessId}
            label="Refresh Reputation Data"
          />
        }
      />

      {!hasInsightData ? (
        <ReputationEmptySyncState
          businessId={businessId}
          title="No review insights yet"
          description="Refresh reputation data to import written reviews and generate themes, keywords, and response insights."
        />
      ) : null}

      {hasInsightData ? (
      <>
      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === "themes" ? (
        <div className="space-y-4">
          {/* 6 metric cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Positive Themes</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {formatNum(data.metrics.positiveThemeMentions)}
              </p>
              <p className="mt-2 text-xs text-[#667085]">Detected categories</p>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Negative Themes</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3F2] text-[#D92D20]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {formatNum(data.metrics.negativeThemeMentions)}
              </p>
              <p className="mt-2 text-xs text-[#667085]">Detected categories</p>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Total Review Text</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                  <FileText className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {formatNum(data.metrics.totalReviewText)}
              </p>
              <p className="mt-2 text-xs text-[#667085]">
                {data.metrics.pctWithText != null ? (
                  <span className="font-semibold text-[#027A48]">{data.metrics.pctWithText}%</span>
                ) : null}
                {data.metrics.pctWithText != null ? " have text" : "Written reviews analyzed"}
              </p>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Avg Review Length</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                  <MessageSquareText className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {data.metrics.avgReviewLength == null ? "--" : `${data.metrics.avgReviewLength}`}
              </p>
              <p className="mt-2 text-xs text-[#667085]">Characters per review</p>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Reviews with Photos</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F3FF] text-[#5925DC]">
                  <Camera className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {data.metrics.reviewsWithPhotos == null ? "--" : formatNum(data.metrics.reviewsWithPhotos)}
              </p>
              <p className="mt-2 text-xs text-[#667085]">
                {data.metrics.photosPct != null ? (
                  <><span className="font-semibold text-[#5925DC]">{data.metrics.photosPct}%</span> include photos</>
                ) : (
                  "Photo data unavailable"
                )}
              </p>
            </div>

            <div className={cn(rep.card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <p className={rep.label}>Employee Mentions</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF8FF] text-[#175CD3]">
                  <UserRoundCheck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
                {formatNum(data.metrics.employeeMentions)}
              </p>
              <p className="mt-2 text-xs text-[#667085]">Names or crew mentions</p>
            </div>
          </div>

          {/* Top themes panels */}
          <div className="grid gap-4 xl:grid-cols-3">
            <ThemePanel title="Top Positive Themes" items={data.themes.positive} tone="positive" />
            <ThemePanel title="Top Negative Themes" items={data.themes.negative} tone="negative" />

            {/* Theme Trend 30 Days line chart */}
            <Card title="Theme Trend 30 Days" description="Daily theme sentiment for the last 30 days when available.">
              {data.themes.themeTrend30d && data.themes.themeTrend30d.length > 0 ? (
                <RepAreaTrendChart
                  data={data.themes.themeTrend30d}
                  xKey="date"
                  height={248}
                  series={[
                    { dataKey: "positive", name: "Positive", color: REP_GREEN },
                    { dataKey: "negative", name: "Negative", color: "#D92D20", fillOpacity: 0.12 },
                    { dataKey: "neutral", name: "Neutral", color: "#98A2B3", dashed: true, fillOpacity: 0.04 },
                  ]}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-sm text-[#667085]">No theme trend data yet.</p>
                  <ReputationSyncButton
                    businessId={businessId}
                    label="Run Theme Sync"
                    variant="secondary"
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Competitor comparison + services/locations */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="Theme Comparison vs Competitors"
              description="How often each theme appears in reviews — you vs competitors and industry."
              className="xl:col-span-2"
            >
              <div className="overflow-x-auto">
                {data.themes.competitorComparison && data.themes.competitorComparison.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E6EAF0] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                        <th className="px-3 py-2 font-semibold">Theme</th>
                        <th className="px-3 py-2 font-semibold text-[#137752]">You</th>
                        <th className="px-3 py-2 font-semibold">Top Competitor</th>
                        <th className="px-3 py-2 font-semibold">2nd Competitor</th>
                        <th className="px-3 py-2 font-semibold">Industry Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.themes.competitorComparison.map((row) => (
                        <tr key={row.theme} className="border-b border-[#F2F4F7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#101828]">{row.theme}</td>
                          <td className="px-3 py-3 tabular-nums font-semibold text-[#137752]">{row.you}%</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{row.topCompetitor}%</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{row.secondCompetitor}%</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{row.industryAvg}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : data.themes.competitorThemes.length === 0 ? (
                  <p className="py-8 text-sm text-[#667085]">
                    Run Review Momentum with competitors to compare review themes.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E6EAF0] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                        <th className="px-3 py-2 font-semibold">Theme</th>
                        <th className="px-3 py-2 font-semibold">You</th>
                        <th className="px-3 py-2 font-semibold">Competitors</th>
                        <th className="px-3 py-2 font-semibold">Competitor Avg</th>
                        <th className="px-3 py-2 font-semibold">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.themes.competitorThemes.map((theme) => (
                        <tr key={theme.label} className="border-b border-[#F2F4F7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#101828]">{theme.label}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.yourCount}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.competitorCount}</td>
                          <td className="px-3 py-3 tabular-nums text-[#344054]">{theme.competitorAvg}</td>
                          <td className={cn("px-3 py-3 tabular-nums font-semibold", theme.gap > 0 ? "text-[#B42318]" : "text-[#027A48]")}>
                            {theme.gap > 0 ? "+" : ""}{theme.gap}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="Most Mentioned Services">
                {data.themes.services && data.themes.services.length > 0 ? (
                  <ServiceMentionList items={data.themes.services} empty="No service mentions found yet." />
                ) : (
                  <MentionList items={data.categorizedKeywords.services} empty="No service mentions found yet." />
                )}
              </Card>
              <Card title="Location Mentions">
                {data.themes.locations && data.themes.locations.length > 0 ? (
                  <ServiceMentionList
                    items={data.themes.locations}
                    empty="No location mentions found yet."
                    barColor="#175CD3"
                  />
                ) : (
                  <MentionList items={data.categorizedKeywords.cities} empty="No location mentions found yet." />
                )}
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-3">
            <p className="text-xs leading-relaxed text-[#027A48]">
              AI-generated review themes are directional and should be validated against source reviews before making business decisions.
            </p>
            {data.dataUpdatedAt ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#027A48]">
                <RefreshCw className="h-3.5 w-3.5" />
                Data updated: {data.dataUpdatedAt}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "keywords" ? (
        <div className="space-y-4">
          <Card
            title="Top Keyword Mentions"
            description="Uncategorized words and phrases found in recent written reviews."
            action={<Search className="h-4 w-4 text-[#137752]" />}
          >
            <div className="flex flex-wrap gap-2">
              {data.servicesAndKeywords.length === 0 ? (
                <p className="py-6 text-sm text-[#667085]">No written review keywords found yet.</p>
              ) : (
                data.servicesAndKeywords.map((item) => (
                  <span
                    key={item.keyword}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-semibold capitalize text-[#344054]"
                  >
                    {item.keyword}
                    <span className="text-[#98A2B3]">{item.count}</span>
                  </span>
                ))
              )}
            </div>
          </Card>

          {/* Service performance summary */}
          {data.themes.services && data.themes.services.length > 0 ? (
            <Card title="Service Mentions" description="Services most frequently referenced in written reviews.">
              <div className="grid gap-4 md:grid-cols-2">
                <ServiceMentionList items={data.themes.services} empty="No service mentions." />
                <div className="space-y-3">
                  {data.themes.services.slice(0, 6).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-[#344054]">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <RepBadge tone="green">{item.pct}%</RepBadge>
                        <span className="text-xs text-[#667085]">{item.count} mentions</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <KeywordPanel title="Services" items={data.categorizedKeywords.services} />
            <KeywordPanel title="Cities" items={data.categorizedKeywords.cities} />
            <KeywordPanel title="Employees" items={data.categorizedKeywords.employees} />
            <KeywordPanel title="Pricing" items={data.categorizedKeywords.pricing} />
            <KeywordPanel title="Speed" items={data.categorizedKeywords.speed} />
            <KeywordPanel title="Communication" items={data.categorizedKeywords.communication} />
          </div>

          {data.dataUpdatedAt ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-3 text-xs text-[#027A48]">
              <RefreshCw className="h-3.5 w-3.5" />
              Data updated: {data.dataUpdatedAt}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "performance" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Stat
              label="Response Rate"
              value={`${data.responsePerformance.responseRate}%`}
              sub={`${formatNum(data.responsePerformance.answered)} of ${formatNum(data.responsePerformance.totalWithText)} written reviews`}
            />
            <Stat
              label="Avg Response Time"
              value={data.responsePerformance.avgResponseTimeDays == null ? "—" : `${data.responsePerformance.avgResponseTimeDays}d`}
              sub="Days from review to reply"
            />
            <Stat
              label="Unanswered Negative"
              value={String(data.responsePerformance.unansweredNegative)}
              sub="Prioritize responding to these"
            />
            <Stat
              label="Unanswered Positive"
              value={String(data.responsePerformance.unansweredPositive)}
              sub="Good candidates for quick replies"
            />
            <Stat
              label="Positive Response Rate"
              value={`${data.responsePerformance.positiveResponseRate}%`}
              sub="Among positive reviews in the window"
            />
            <Stat
              label="Negative Response Rate"
              value={`${data.responsePerformance.negativeResponseRate}%`}
              sub="Among negative reviews in the window"
            />
            <Stat
              label="Oldest Unanswered"
              value={data.responsePerformance.oldestUnansweredDays == null ? "—" : `${data.responsePerformance.oldestUnansweredDays}d`}
              sub={data.responsePerformance.oldestUnansweredAt ?? "No unanswered reviews"}
            />
            <Stat
              label="Unanswered Neutral"
              value={String(data.responsePerformance.unansweredNeutral)}
              sub="Low priority but worth a reply"
            />
          </div>

          <Card title="Response Coverage" description="Breakdown of answered and unanswered reviews by type.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseBars} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#F2F4F7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#667085" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
                  <Bar dataKey="count" fill={REP_GREEN} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="rounded-xl border border-[#D1FADF] bg-[#ECFDF3] px-4 py-3 text-xs leading-relaxed text-[#027A48]">
            Response rate measures replies to reviews with written text within the date window. Star-only reviews are excluded.
          </div>
        </div>
      ) : null}

      {activeTab === "quality" ? (
        <div className="space-y-4">
          <div className={cn(rep.card, "border-[#D1FADF] bg-gradient-to-br from-[#ECFDF3]/80 to-white p-4")}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D1FADF] text-[#137752]">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <p className={cn(rep.label, "text-[#137752]")}>Response Quality Summary</p>
                <h2 className="mt-1 text-xl font-bold text-[#101828]">
                  {data.responseQuality.genericResponseSuspected} generic replies suspected
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#344054]">
                  Quality heuristics check personalization, copy/paste clusters, defensive wording, issue addressing, and resolution offers. Use this data to coach your team.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Generic Rate" value={`${data.responseQuality.genericResponsePct}%`} sub="Of answered reviews" />
            <Stat label="Personalized" value={`${data.responseQuality.qualitySummary.personalizedPct}%`} sub="Mentions specifics" />
            <Stat label="Copy/Paste" value={`${data.responseQuality.qualitySummary.copyPastePct}%`} sub="Repeated clusters" />
            <Stat label="Addresses Issue" value={`${data.responseQuality.qualitySummary.addressesIssuePct}%`} sub="For negative reviews" />
            <Stat label="Offers Resolution" value={`${data.responseQuality.qualitySummary.offersResolutionPct}%`} sub="Refund, call, credit" />
            <Stat label="Defensive Replies" value={String(data.responseQuality.qualitySummary.defensiveCount)} sub="May escalate issues" />
          </div>

          <Card title="Response Quality Detail" description="Review-level quality signals from owner responses.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E6EAF0] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                    <th className="px-3 py-2">Review</th>
                    <th className="px-3 py-2">Personalized</th>
                    <th className="px-3 py-2">Generic</th>
                    <th className="px-3 py-2">Copy/Paste</th>
                    <th className="px-3 py-2">Defensive</th>
                    <th className="px-3 py-2">Addresses Issue</th>
                    <th className="px-3 py-2">Offers Resolution</th>
                    <th className="px-3 py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.responseQuality.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-[#667085]" colSpan={8}>
                        No owner responses found in the current window.
                      </td>
                    </tr>
                  ) : (
                    data.responseQuality.rows.slice(0, 50).map((row, idx) => (
                      <tr key={row.reviewId ?? idx} className="border-b border-[#F2F4F7] last:border-0">
                        <td className="max-w-[12rem] truncate px-3 py-3 text-[#667085]">{row.reviewId ?? "—"}</td>
                        <td className="px-3 py-3"><BoolBadge value={row.personalized} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.generic} /></td>
                        <td className="px-3 py-3 text-[#344054]">{row.copyPasteClusterId ?? "—"}</td>
                        <td className="px-3 py-3"><BoolBadge value={row.defensive} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.addressesIssue} /></td>
                        <td className="px-3 py-3"><BoolBadge value={row.offersResolution} /></td>
                        <td className="max-w-sm px-3 py-3 text-[#667085]">{row.evidence.join("; ") || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
      </>
      ) : null}
    </ModulePage>
  );
}
