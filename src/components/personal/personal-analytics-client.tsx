"use client";

import type { PersonalAnalyticsSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { downloadPersonalCsv } from "@/lib/workspace/personal-export";
import {
  WIREFRAME_ANALYTICS_BY_NUMBER,
  WIREFRAME_ANALYTICS_CHART_LABELS,
  WIREFRAME_ANALYTICS_FORWARDING,
  WIREFRAME_ANALYTICS_INSIGHTS,
  WIREFRAME_ANALYTICS_KPIS,
  WIREFRAME_ANALYTICS_MISSED,
  WIREFRAME_ANALYTICS_SMART_ROUTING,
  WIREFRAME_ANALYTICS_TOP_NUMBERS,
  WIREFRAME_ANALYTICS_USAGE,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  Minus,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  TrendingUp,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PersonalMockBarChart,
  PersonalMockDonut,
  PersonalMockLineChart,
  PersonalMockProgress,
  PersonalMockSparkline,
} from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockSection,
  PersonalMockSelect,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";
import { PersonalNumberSelector } from "./personal-number-selector";

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function trendArrow(value: number) {
  if (value > 0) return <ArrowUp className="h-3 w-3" />;
  if (value < 0) return <ArrowDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

export function PersonalAnalyticsClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const searchParams = useSearchParams();
  const [days, setDays] = useState(30);
  const [comparePeriod, setComparePeriod] = useState(true);
  const [chartGranularity, setChartGranularity] = useState("Day");
  const [hourFilter, setHourFilter] = useState("All Days");
  const [data, setData] = useState<PersonalAnalyticsSummary | null>(null);
  const [priorData, setPriorData] = useState<PersonalAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailSearch, setDetailSearch] = useState("");
  const numberId = searchParams.get("numberId") || initialNumberId || "";

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (numberId) params.set("numberId", numberId);
    const res = await fetch(`/api/personal/analytics?${params}`);
    const j = await res.json().catch(() => ({}));
    setData(j.data ?? null);

    if (comparePeriod) {
      const priorParams = new URLSearchParams({
        days: String(days),
        offsetDays: String(days),
      });
      if (numberId) priorParams.set("numberId", numberId);
      const priorRes = await fetch(`/api/personal/analytics?${priorParams}`);
      const priorJson = await priorRes.json().catch(() => ({}));
      setPriorData(priorJson.data ?? null);
    } else {
      setPriorData(null);
    }
    setLoading(false);
  }, [days, numberId, comparePeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const useWireframe = usePersonalWireframe(data?.totalCalls ?? 0);
  const kpi = WIREFRAME_ANALYTICS_KPIS;

  const display = useMemo(() => {
    if (!useWireframe) {
      if (!data) return null;
      const trends = priorData
        ? {
            total: pctChange(data.totalCalls, priorData.totalCalls),
            answered: pctChange(data.answered, priorData.answered),
            missed: pctChange(data.missed, priorData.missed),
            voicemails: pctChange(data.voicemails, priorData.voicemails),
            forwarded: pctChange(data.forwardedMinutes, priorData.forwardedMinutes),
            avgDuration: pctChange(
              data.averageDurationSeconds,
              priorData.averageDurationSeconds,
            ),
          }
        : {
            total: 0,
            answered: 0,
            missed: 0,
            voicemails: 0,
            forwarded: 0,
            avgDuration: 0,
          };
      return {
        totalCalls: data.totalCalls,
        answered: data.answered,
        missed: data.missed,
        voicemails: data.voicemails,
        failed: 0,
        blocked: 0,
        forwardedMinutes: data.forwardedMinutes,
        avgDurationSec: data.averageDurationSeconds,
        periodLabel: `Last ${days} days`,
        trends,
      };
    }
    return {
      totalCalls: kpi.totalCalls,
      answered: kpi.answered,
      missed: kpi.missed,
      voicemails: kpi.voicemails,
      failed: kpi.failed,
      blocked: kpi.blocked,
      forwardedMinutes: kpi.forwardedMinutes,
      avgDurationSec: kpi.avgDurationSec,
      periodLabel: kpi.periodLabel,
      trends: kpi.trends,
    };
  }, [useWireframe, data, priorData, days, kpi]);

  const chartLabels = useWireframe
    ? WIREFRAME_ANALYTICS_CHART_LABELS
    : data?.byDay.slice(-14).map((d) => d.date.slice(5)) ?? [];

  const volumeSeries = useMemo(() => {
    if (useWireframe) {
      const total = [28, 35, 42, 38, 45, 52, 48, 55];
      const answered = [18, 24, 28, 26, 32, 38, 34, 40];
      const missed = [6, 8, 9, 7, 10, 8, 9, 10];
      const voicemail = [4, 3, 5, 4, 5, 6, 5, 5];
      return [
        { label: "Total", color: "#6366f1", values: total },
        { label: "Answered", color: "#10b981", values: answered },
        { label: "Missed", color: "#f97316", values: missed },
        { label: "Voicemail", color: "#8b5cf6", values: voicemail },
      ];
    }
    if (!data) return [];
    const values = data.byDay.slice(-14).map((d) => d.calls);
    return [
      { label: "Total", color: "#6366f1", values },
      {
        label: "Answered",
        color: "#10b981",
        values: values.map((v) =>
          Math.round(v * (data.answered / Math.max(data.totalCalls, 1))),
        ),
      },
      {
        label: "Missed",
        color: "#f97316",
        values: values.map((v) =>
          Math.round(v * (data.missed / Math.max(data.totalCalls, 1))),
        ),
      },
    ];
  }, [useWireframe, data]);

  const byNumberRows = useWireframe
    ? WIREFRAME_ANALYTICS_BY_NUMBER
    : (data?.byNumber ?? []).map((n) => ({
        number: n.e164,
        friendlyName: n.label || "—",
        calls: n.calls,
        answered: Math.round(n.calls * 0.65),
        missed: Math.round(n.calls * 0.2),
        voicemail: Math.round(n.calls * 0.05),
        minutes: n.calls * 2,
        answerRate: n.calls ? 65 : 0,
        trend: [n.calls, n.calls + 1, n.calls, n.calls + 2, n.calls],
      }));

  const filteredDetail = byNumberRows.filter((r) => {
    const q = detailSearch.trim().toLowerCase();
    if (!q) return true;
    return r.number.includes(q) || r.friendlyName.toLowerCase().includes(q);
  });

  function exportAnalytics() {
    if (!data) return;
    const headers = ["Number", "Label", "Calls"];
    const rows = data.byNumber.map((n) => [n.e164, n.label, String(n.calls)]);
    downloadPersonalCsv(`analytics-${days}d.csv`, headers, rows);
  }

  if (loading && !useWireframe) {
    return (
      <PersonalMockPage>
        <PersonalMockHeader title="Analytics" description="Understand call volume, outcomes, routing performance, and number usage across your account." />
        <p className={pm.muted}>Loading analytics…</p>
      </PersonalMockPage>
    );
  }

  if (!display) {
    return (
      <PersonalMockPage>
        <PersonalMockHeader title="Analytics" description="Understand call volume, outcomes, routing performance, and number usage across your account." />
        <p className={pm.muted}>No analytics data yet.</p>
      </PersonalMockPage>
    );
  }

  return (
    <PersonalMockPage
      right={
        <>
          <PersonalMockSection title="Period Summary">
            <p className="mb-3 text-[11px] text-[#6b7280]">{display.periodLabel}</p>
            <ul className="space-y-2.5 text-[13px]">
              {[
                { label: "Total Calls", value: display.totalCalls, trend: display.trends.total },
                { label: "Answered", value: display.answered, trend: display.trends.answered },
                { label: "Missed", value: display.missed, trend: display.trends.missed },
                { label: "Voicemails", value: display.voicemails, trend: display.trends.voicemails },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-[#6b7280]">{row.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-[#111827]">{row.value}</span>
                    {comparePeriod ? (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-[11px] font-semibold",
                          row.trend >= 0 ? "text-[#059669]" : "text-[#dc2626]",
                        )}
                      >
                        {trendArrow(row.trend)}
                        {Math.abs(row.trend)}%
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/personal/analytics" className="mt-3 text-[12px] font-semibold text-[#6366f1]">
              View all
            </Link>
          </PersonalMockSection>

          <PersonalMockSection
            title="Insights"
            action={
              <button type="button" className="text-[12px] font-semibold text-[#6366f1]">
                View all
              </button>
            }
          >
            <ul className="space-y-3">
              {WIREFRAME_ANALYTICS_INSIGHTS.map((insight) => (
                <li
                  key={insight.id}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    insight.tone === "green" && "border-[#bbf7d0] bg-[#ecfdf5]",
                    insight.tone === "orange" && "border-[#fed7aa] bg-[#fffbeb]",
                    insight.tone === "purple" && "border-[#ddd6fe] bg-[#f5f3ff]",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    {insight.tone === "green" ? (
                      <TrendingUp className="h-4 w-4 text-[#059669]" />
                    ) : insight.tone === "orange" ? (
                      <PhoneMissed className="h-4 w-4 text-[#ea580c]" />
                    ) : (
                      <Voicemail className="h-4 w-4 text-[#7c3aed]" />
                    )}
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6b7280]">{insight.detail}</p>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection
            title="Usage"
            action={
              <button type="button" className="text-[12px] font-semibold text-[#6366f1]">
                View all
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Total Numbers</span>
                <span className="font-semibold">
                  {useWireframe ? WIREFRAME_ANALYTICS_USAGE.totalNumbers : numbers.length}
                </span>
              </div>
              <PersonalMockProgress
                label="Active Numbers"
                value={
                  useWireframe
                    ? WIREFRAME_ANALYTICS_USAGE.activeNumbers
                    : numbers.filter((n) => n.serviceState !== "PARKED").length
                }
                max={useWireframe ? WIREFRAME_ANALYTICS_USAGE.totalNumbers : Math.max(numbers.length, 1)}
              />
              <PersonalMockProgress
                label="Minutes Used"
                value={
                  useWireframe ? WIREFRAME_ANALYTICS_USAGE.minutesUsed : display.forwardedMinutes
                }
                max={
                  useWireframe ? WIREFRAME_ANALYTICS_USAGE.minutesLimit : 1000
                }
              />
              <PersonalMockProgress
                label="Voicemail Storage"
                value={useWireframe ? WIREFRAME_ANALYTICS_USAGE.voicemailStorageGb : 1}
                max={useWireframe ? WIREFRAME_ANALYTICS_USAGE.voicemailStorageLimitGb : 10}
                sub="GB"
              />
            </div>
          </PersonalMockSection>

          <div className={pm.card + " p-4"}>
            <p className="text-[13px] font-semibold text-[#111827]">Export Report</p>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              Download a detailed CSV report for this period.
            </p>
            <PersonalMockBtn className="mt-3 w-full gap-1.5" onClick={exportAnalytics}>
              <Download className="h-4 w-4" />
              Export Analytics Report
            </PersonalMockBtn>
          </div>
        </>
      }
    >
      <PersonalMockHeader
        title="Analytics"
        description="Understand call volume, outcomes, routing performance, and number usage across your account."
        actions={
          <>
            <PersonalNumberSelector
              numbers={numbers}
              selectedId={numberId || undefined}
              allowAll
              label=""
              selectClassName="h-9 w-[140px] rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12px] font-semibold text-[#111827]"
            />
            <PersonalMockSelect
              className="w-[140px]"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </PersonalMockSelect>
            <PersonalMockToggle
              label="Compare to Previous Period"
              checked={comparePeriod}
              onChange={setComparePeriod}
            />
            <PersonalMockBtn variant="outline" className="gap-1.5" onClick={exportAnalytics}>
              <Download className="h-4 w-4" />
              Export Report
            </PersonalMockBtn>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PersonalMockKpi
          label="Total Calls"
          value={display.totalCalls}
          icon={PhoneIncoming}
          trend={comparePeriod ? Math.round(display.trends.total) : undefined}
          trendLabel="vs previous"
        />
        <PersonalMockKpi
          label="Answered"
          value={display.answered}
          icon={Phone}
          iconClass="bg-[#ecfdf5] text-[#059669]"
          trend={comparePeriod ? Math.round(display.trends.answered) : undefined}
          trendLabel="vs previous"
        />
        <PersonalMockKpi
          label="Missed"
          value={display.missed}
          icon={PhoneMissed}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
          trend={comparePeriod ? Math.round(display.trends.missed) : undefined}
          trendLabel="vs previous"
        />
        <PersonalMockKpi
          label="Voicemails"
          value={display.voicemails}
          icon={Voicemail}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
          trend={comparePeriod ? Math.round(display.trends.voicemails) : undefined}
          trendLabel="vs previous"
        />
        <PersonalMockKpi
          label="Forwarded Minutes"
          value={display.forwardedMinutes}
          icon={Clock}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
          trend={comparePeriod ? Math.round(display.trends.forwarded) : undefined}
          trendLabel="vs previous"
        />
        <PersonalMockKpi
          label="Avg Duration"
          value={formatDuration(display.avgDurationSec)}
          icon={Clock}
          iconClass="bg-[#eef2ff] text-[#6366f1]"
          trend={comparePeriod ? Math.round(display.trends.avgDuration) : undefined}
          trendLabel="vs previous"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PersonalMockSection
          title="Call Volume"
          action={
            <PersonalMockSelect
              className="h-8 w-[90px] text-[12px]"
              value={chartGranularity}
              onChange={(e) => setChartGranularity(e.target.value)}
            >
              <option>Day</option>
              <option>Week</option>
            </PersonalMockSelect>
          }
        >
          <PersonalMockLineChart labels={chartLabels} series={volumeSeries} height={240} />
        </PersonalMockSection>
        <PersonalMockSection title="Call Outcomes">
          <PersonalMockDonut
            centerValue={String(display.totalCalls)}
            centerLabel="Total Calls"
            segments={[
              { label: "Answered", value: display.answered, color: "#10b981" },
              { label: "Missed", value: display.missed, color: "#f97316" },
              { label: "Voicemails", value: display.voicemails, color: "#8b5cf6" },
              { label: "Failed", value: display.failed, color: "#ef4444" },
              { label: "Blocked", value: display.blocked, color: "#6366f1" },
            ]}
          />
        </PersonalMockSection>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PersonalMockSection
          title="Calls by Hour"
          action={
            <PersonalMockSelect
              className="h-8 w-[110px] text-[12px]"
              value={hourFilter}
              onChange={(e) => setHourFilter(e.target.value)}
            >
              <option>All Days</option>
              <option>Weekdays</option>
              <option>Weekends</option>
            </PersonalMockSelect>
          }
        >
          <PersonalMockBarChart
            items={
              useWireframe
                ? [
                    { label: "8 AM", value: 24 },
                    { label: "10 AM", value: 42 },
                    { label: "12 PM", value: 58 },
                    { label: "2 PM", value: 72 },
                    { label: "4 PM", value: 48 },
                    { label: "6 PM", value: 22 },
                  ]
                : (data?.byHour.filter((h) => h.calls > 0).slice(0, 8) ?? []).map((h) => ({
                    label: `${h.hour}:00`,
                    value: h.calls,
                  }))
            }
          />
        </PersonalMockSection>
        <PersonalMockSection title="Calls by Day">
          <PersonalMockBarChart
            items={
              useWireframe
                ? WIREFRAME_ANALYTICS_CHART_LABELS.map((l, i) => ({
                    label: l,
                    value: 28 + i * 4,
                  }))
                : (data?.byDay.slice(-7) ?? []).map((d) => ({
                    label: d.date,
                    value: d.calls,
                  }))
            }
            barClass="bg-[#93c5fd]"
          />
        </PersonalMockSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalMockSection
          title="Performance by Number"
          action={
            <Link href="/personal/numbers" className="text-[12px] font-semibold text-[#6366f1]">
              View all numbers &gt;
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                  <th className="pb-3 pr-2">Number</th>
                  <th className="pb-3 pr-2">Name</th>
                  <th className="pb-3 pr-2">Calls</th>
                  <th className="pb-3 pr-2">Answered</th>
                  <th className="pb-3 pr-2">Missed</th>
                  <th className="pb-3 pr-2">VM</th>
                  <th className="pb-3 pr-2">Min</th>
                  <th className="pb-3">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {byNumberRows.slice(0, 4).map((n) => (
                  <tr key={n.number}>
                    <td className="py-2.5 pr-2 font-medium">{formatPhone(n.number)}</td>
                    <td className="py-2.5 pr-2 text-[#6b7280]">{n.friendlyName}</td>
                    <td className="py-2.5 pr-2">{n.calls}</td>
                    <td className="py-2.5 pr-2">{n.answered}</td>
                    <td className="py-2.5 pr-2">{n.missed}</td>
                    <td className="py-2.5 pr-2">{n.voicemail}</td>
                    <td className="py-2.5 pr-2">{n.minutes}</td>
                    <td className="py-2.5 font-semibold">{n.answerRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PersonalMockSection>

        <PersonalMockSection
          title="Top Numbers"
          action={
            <PersonalMockSelect className="h-8 w-[130px] text-[12px]">
              <option>By Answer Rate</option>
            </PersonalMockSelect>
          }
        >
          <ol className="space-y-3">
            {WIREFRAME_ANALYTICS_TOP_NUMBERS.map((n) => (
              <li key={n.rank} className="flex items-center gap-3 text-[13px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[12px] font-bold text-[#6b7280]">
                  {n.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#111827]">{n.name}</p>
                  <p className="text-[11px] text-[#6b7280]">{formatPhone(n.number)}</p>
                </div>
                <span className="font-semibold text-[#111827]">{n.rate}%</span>
                {n.trend === "up" ? (
                  <ArrowUp className="h-4 w-4 text-[#059669]" />
                ) : n.trend === "down" ? (
                  <ArrowDown className="h-4 w-4 text-[#dc2626]" />
                ) : (
                  <Minus className="h-4 w-4 text-[#9ca3af]" />
                )}
              </li>
            ))}
          </ol>
          <Link href="/personal/analytics" className="mt-3 text-[12px] font-semibold text-[#6366f1]">
            View all rankings &gt;
          </Link>
        </PersonalMockSection>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <PersonalMockSection title="Forwarding Performance">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Forwarded Calls</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_FORWARDING.forwardedCalls}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Forwarded Minutes</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_FORWARDING.forwardedMinutes}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Avg Ring Time</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_FORWARDING.avgRingSeconds}s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Connections</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_FORWARDING.connections}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] font-semibold text-[#111827]">Top Destinations</p>
          <PersonalMockBarChart
            items={WIREFRAME_ANALYTICS_FORWARDING.destinations.map((d) => ({
              label: d.label,
              value: d.pct,
            }))}
            barClass="bg-[#6366f1]"
          />
        </PersonalMockSection>

        <PersonalMockSection title="Smart Routing Performance">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Routes Evaluated</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_SMART_ROUTING.routesEvaluated}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Efficiency</dt>
              <dd className="font-semibold">{WIREFRAME_ANALYTICS_SMART_ROUTING.efficiencyPct}%</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] font-semibold text-[#111827]">Menu Selections</p>
          <PersonalMockBarChart
            items={WIREFRAME_ANALYTICS_SMART_ROUTING.menuSelections.map((m) => ({
              label: m.label,
              value: m.pct,
            }))}
            barClass="bg-[#8b5cf6]"
          />
        </PersonalMockSection>

        <PersonalMockSection title="Missed Call Analysis">
          <ul className="space-y-2 text-[13px]">
            {WIREFRAME_ANALYTICS_MISSED.map((m) => (
              <li key={m.reason} className="flex justify-between gap-2">
                <span className="text-[#374151]">{m.reason}</span>
                <span className="shrink-0 text-[#6b7280]">
                  {m.count} · {m.pct}%
                </span>
              </li>
            ))}
          </ul>
        </PersonalMockSection>

        <PersonalMockSection title="Missed Call Distribution">
          <PersonalMockDonut
            centerValue={String(display.missed)}
            centerLabel="Missed Calls"
            size={120}
            segments={WIREFRAME_ANALYTICS_MISSED.map((m, i) => ({
              label: m.reason,
              value: m.count,
              color: ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"][i] ?? "#f97316",
            }))}
          />
        </PersonalMockSection>
      </div>

      <PersonalMockSection
        title="Number Performance"
        action={
          <div className="flex flex-wrap gap-2">
            <PersonalMockInput
              placeholder="Search numbers…"
              className="w-48"
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
            />
            <PersonalMockBtn variant="outline" className="h-8 text-[12px]">Filters</PersonalMockBtn>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                <th className="pb-3 pr-3">Number</th>
                <th className="pb-3 pr-3">Friendly Name</th>
                <th className="pb-3 pr-3">Calls</th>
                <th className="pb-3 pr-3">Answered</th>
                <th className="pb-3 pr-3">Missed</th>
                <th className="pb-3 pr-3">Voicemail</th>
                <th className="pb-3 pr-3">Minutes</th>
                <th className="pb-3 pr-3">Avg Duration</th>
                <th className="pb-3 pr-3">Answer Rate</th>
                <th className="pb-3 pr-3">Trend</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {filteredDetail.slice(0, 10).map((n) => (
                <tr key={n.number}>
                  <td className="py-3 pr-3 font-medium">{formatPhone(n.number)}</td>
                  <td className="py-3 pr-3 text-[#6b7280]">{n.friendlyName}</td>
                  <td className="py-3 pr-3">{n.calls}</td>
                  <td className="py-3 pr-3">{n.answered}</td>
                  <td className="py-3 pr-3">{n.missed}</td>
                  <td className="py-3 pr-3">{n.voicemail}</td>
                  <td className="py-3 pr-3">{n.minutes}</td>
                  <td className="py-3 pr-3">
                    {formatDuration(Math.round((n.minutes * 60) / Math.max(n.calls, 1)))}
                  </td>
                  <td className="py-3 pr-3 font-semibold">{n.answerRate}%</td>
                  <td className="py-3 pr-3">
                    <PersonalMockSparkline points={n.trend} color="#10b981" />
                  </td>
                  <td className="py-3 text-right text-[#9ca3af]">⋯</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PersonalMockPagination
          showing="Showing 1 to 10 of 128 results"
          total={128}
          pages={13}
          pageSizeLabel="10 / page"
        />
      </PersonalMockSection>
    </PersonalMockPage>
  );
}
