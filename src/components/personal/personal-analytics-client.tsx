"use client";

import type { PersonalAnalyticsSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_ANALYTICS_KPIS,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { formatPhone } from "@/lib/utils";
import { Calendar, ChevronDown, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockSection,
  PersonalMockSelect,
  pm,
} from "./mockup/primitives";

function pctChange(current: number, prior: number) {
  if (!prior) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

export function PersonalAnalyticsClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PersonalAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const numberId = initialNumberId;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (numberId) params.set("numberId", numberId);
    const res = await fetch(`/api/personal/analytics?${params}`);
    const j = await res.json().catch(() => ({}));
    setData(j.data ?? null);
    setLoading(false);
  }, [days, numberId]);

  useEffect(() => {
    load();
  }, [load]);

  const chartLabels = useMemo(() => {
    if (!data?.byDay.length) return ["Week 1", "Week 2", "Week 3", "Week 4"];
    return data.byDay.slice(-14).map((d) => d.date.slice(5));
  }, [data]);

  const volumeSeries = useMemo(() => {
    if (!data) return [];
    const values = data.byDay.slice(-14).map((d) => d.calls);
    const answered = values.map((v) =>
      Math.round(v * (data.answered / Math.max(data.totalCalls, 1))),
    );
    const missed = values.map((v) =>
      Math.round(v * (data.missed / Math.max(data.totalCalls, 1))),
    );
    return [
      { label: "Total", color: "#6366f1", values },
      { label: "Answered", color: "#10b981", values: answered },
      { label: "Missed", color: "#f97316", values: missed },
    ];
  }, [data]);

  const useWireframe = data ? usePersonalWireframe(data.totalCalls) : false;
  const kpi = useWireframe ? WIREFRAME_ANALYTICS_KPIS : null;

  const displayData = data && useWireframe
    ? {
        ...data,
        totalCalls: kpi!.totalCalls,
        answered: kpi!.answered,
        missed: kpi!.missed,
        voicemails: kpi!.voicemails,
        forwardedMinutes: kpi!.forwardedMinutes,
        averageDurationSeconds: kpi!.avgDurationSec,
      }
    : data;

  const answerRate = displayData && displayData.totalCalls
    ? ((displayData.answered / displayData.totalCalls) * 100).toFixed(1)
    : "0";

  return (
    <PersonalMockPage
      right={
        data && displayData ? (
          <>
            <PersonalMockSection title="Period Summary">
              <ul className="space-y-2 text-[13px]">
                <li className="flex justify-between">
                  <span>Total Calls</span>
                  <span className="font-semibold">{displayData.totalCalls}</span>
                </li>
                <li className="flex justify-between">
                  <span>Answered</span>
                  <span className="font-semibold">{displayData.answered}</span>
                </li>
                <li className="flex justify-between">
                  <span>Missed</span>
                  <span className="font-semibold">{displayData.missed}</span>
                </li>
                <li className="flex justify-between">
                  <span>Voicemails</span>
                  <span className="font-semibold">{displayData.voicemails}</span>
                </li>
              </ul>
            </PersonalMockSection>
            <PersonalMockSection title="Insights">
              <ul className="space-y-2 text-[12px] text-[#6b7280]">
                <li>Answer rate is {answerRate}% for this period.</li>
                <li>
                  Peak activity clusters around business hours.
                </li>
                {displayData.voicemails > 0 ? (
                  <li>Voicemails up vs prior periods — review inbox.</li>
                ) : null}
              </ul>
            </PersonalMockSection>
            <PersonalMockSection title="Usage">
              <PersonalMockProgress
                label="Minutes Used"
                value={displayData.forwardedMinutes}
                max={1000}
              />
              <PersonalMockProgress
                label="Active Numbers"
                value={numbers.filter((n) => n.serviceState !== "PARKED").length}
                max={Math.max(numbers.length, 1)}
                sub={`${numbers.length} total numbers`}
              />
            </PersonalMockSection>
            <div className={pm.card + " p-4"}>
              <p className="text-[13px] font-semibold text-[#111827]">Export Report</p>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Download a detailed CSV report for this period.
              </p>
              <PersonalMockBtn className="mt-3 w-full gap-1.5">
                <Download className="h-4 w-4" />
                Export Analytics Report
              </PersonalMockBtn>
            </div>
          </>
        ) : null
      }
    >
      <PersonalMockHeader
        title="Analytics"
        description="Understand call volume, outcomes, routing performance, and number usage across your account."
        actions={
          <>
            <PersonalMockSelect className="w-[140px]">
              <option>All Numbers</option>
              {numbers.map((n) => (
                <option key={n.id}>{formatPhone(n.number)}</option>
              ))}
            </PersonalMockSelect>
            <PersonalMockBtn variant="outline" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Last {days} Days
              <ChevronDown className="h-3.5 w-3.5" />
            </PersonalMockBtn>
            <PersonalMockBtn variant="outline">Compare to Previous Period</PersonalMockBtn>
            <PersonalMockBtn variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />
              Export Report
            </PersonalMockBtn>
          </>
        }
        filters={
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                  days === d ? "bg-[#2563eb] text-white" : "bg-[#f3f4f6] text-[#374151]"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />

      {loading || !displayData ? (
        <p className={pm.muted}>Loading analytics…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <PersonalMockKpi
              label="Total Calls"
              value={displayData.totalCalls}
              trend={useWireframe ? kpi!.trends.total : pctChange(displayData.totalCalls, displayData.totalCalls - 2)}
            />
            <PersonalMockKpi
              label="Answered"
              value={displayData.answered}
              trend={useWireframe ? kpi!.trends.answered : pctChange(displayData.answered, displayData.answered - 1)}
              iconClass="bg-[#ecfdf5] text-[#059669]"
            />
            <PersonalMockKpi
              label="Missed"
              value={displayData.missed}
              trend={useWireframe ? kpi!.trends.missed : -pctChange(displayData.missed, displayData.missed + 1)}
              iconClass="bg-[#fff7ed] text-[#ea580c]"
            />
            <PersonalMockKpi
              label="Voicemails"
              value={displayData.voicemails}
              trend={useWireframe ? kpi!.trends.voicemails : 8}
              iconClass="bg-[#f5f3ff] text-[#7c3aed]"
            />
            <PersonalMockKpi
              label="Forwarded Minutes"
              value={displayData.forwardedMinutes}
              trend={useWireframe ? kpi!.trends.forwarded : 15}
            />
            <PersonalMockKpi
              label="Avg Duration"
              value={`${Math.floor(displayData.averageDurationSeconds / 60)}:${(
                displayData.averageDurationSeconds % 60
              )
                .toString()
                .padStart(2, "0")}`}
              trend={useWireframe ? kpi!.trends.avgDuration : 7}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <PersonalMockSection title="Call Volume">
              <PersonalMockLineChart labels={chartLabels} series={volumeSeries} height={240} />
            </PersonalMockSection>
            <PersonalMockSection title="Call Outcomes">
              <PersonalMockDonut
                centerValue={String(displayData.totalCalls)}
                centerLabel="Total Calls"
                segments={[
                  { label: "Answered", value: displayData.answered, color: "#10b981" },
                  { label: "Missed", value: displayData.missed, color: "#f97316" },
                  { label: "Voicemails", value: displayData.voicemails, color: "#8b5cf6" },
                ]}
              />
            </PersonalMockSection>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <PersonalMockSection title="Calls by Hour">
              <PersonalMockBarChart
                items={displayData.byHour
                  .filter((h) => h.calls > 0)
                  .slice(0, 8)
                  .map((h) => ({ label: `${h.hour}:00`, value: h.calls }))}
              />
            </PersonalMockSection>
            <PersonalMockSection title="Calls by Day">
              <PersonalMockBarChart
                items={displayData.byDay.slice(-7).map((d) => ({
                  label: d.date,
                  value: d.calls,
                }))}
                barClass="bg-[#93c5fd]"
              />
            </PersonalMockSection>
          </div>

          <PersonalMockSection title="Performance by Number">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                    <th className="pb-3 pr-3">Number</th>
                    <th className="pb-3 pr-3">Calls</th>
                    <th className="pb-3 pr-3">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {displayData.byNumber
                    .filter((n) => n.calls > 0)
                    .sort((a, b) => b.calls - a.calls)
                    .map((n) => (
                      <tr key={n.numberId}>
                        <td className="py-3 pr-3 font-medium">{formatPhone(n.e164)}</td>
                        <td className="py-3 pr-3">{n.calls}</td>
                        <td className="py-3 pr-3">
                          <PersonalMockSparkline
                            points={[n.calls, n.calls + 1, n.calls, n.calls + 2, n.calls]}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </PersonalMockSection>
        </>
      )}
    </PersonalMockPage>
  );
}
