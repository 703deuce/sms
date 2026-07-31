"use client";

import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { formatNumber } from "@/lib/utils";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type Analytics = {
  periodDays: number;
  totalCalls: number;
  inbound: number;
  outbound: number;
  answerRate: number;
  qualifiedRate: number;
  appointmentRate: number;
  totalCostCents: number;
  aiMinutes: number;
  telephonyMinutes: number;
  byDay: Record<string, number>;
  toolSuccessRate: number;
  toolFailures: number;
};

export default function VoiceAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch(`/api/voice/analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [days]);

  const maxDay = Math.max(1, ...Object.values(data?.byDay || {}).map(Number));

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Conversion, cost, and intent analytics with exportable reports."
        actions={
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <a
              href={`/api/voice/analytics/export?days=${days}`}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" /> CSV export
            </a>
          </div>
        }
      />
      <VoiceSubNav />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total calls" value={formatNumber(data?.totalCalls ?? 0)} />
        <StatCard label="Answer rate" value={`${Math.round((data?.answerRate ?? 0) * 100)}%`} />
        <StatCard label="Qualified rate" value={`${Math.round((data?.qualifiedRate ?? 0) * 100)}%`} />
        <StatCard label="Appointment rate" value={`${Math.round((data?.appointmentRate ?? 0) * 100)}%`} />
        <StatCard label="Inbound" value={formatNumber(data?.inbound ?? 0)} />
        <StatCard label="Outbound" value={formatNumber(data?.outbound ?? 0)} />
        <StatCard label="AI minutes" value={data?.aiMinutes?.toFixed(1) ?? "0"} />
        <StatCard
          label="Total cost"
          value={`$${((data?.totalCostCents ?? 0) / 100).toFixed(2)}`}
        />
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-medium">Calls per day</h2>
        <div className="flex items-end gap-1 h-32">
          {Object.entries(data?.byDay || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, count]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-blue-500 min-h-[2px]"
                  style={{ height: `${(Number(count) / maxDay) * 100}%` }}
                  title={`${day}: ${count}`}
                />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                  {day.slice(5)}
                </span>
              </div>
            ))}
          {!Object.keys(data?.byDay || {}).length && (
            <p className="text-sm text-muted-foreground">No call data for this period.</p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 font-medium">Tool execution</h2>
        <p className="text-sm text-muted-foreground">
          Success rate: {Math.round((data?.toolSuccessRate ?? 0) * 100)}% ·
          Failures: {data?.toolFailures ?? 0}
        </p>
      </Card>
    </div>
  );
}
