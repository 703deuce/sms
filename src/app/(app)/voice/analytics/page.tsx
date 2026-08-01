"use client";

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
  noAnswerRate: number;
  failureRate: number;
  voicemailRate: number;
  transferRate: number;
  successfulTransferRate: number;
  qualifiedRate: number;
  appointmentRate: number;
  avgDurationSeconds: number;
  totalCostCents: number;
  costPerCall: number;
  aiMinutes: number;
  telephonyMinutes: number;
  modelCostCents: number;
  transcriptionCostCents: number;
  costPerQualifiedLead: number;
  costPerAppointment: number;
  byDay: Record<string, number>;
  byCampaign: Record<string, number>;
  outcomes: Record<string, number>;
  sentimentCounts: Record<string, number>;
  toolSuccessRate: number;
  toolFailures: number;
};

export default function VoiceAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [direction, setDirection] = useState("");
  const [outcome, setOutcome] = useState("");
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days) });
    if (direction) params.set("direction", direction);
    if (outcome) params.set("outcome", outcome);
    fetch(`/api/voice/analytics?${params}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [days, direction, outcome]);

  const maxDay = Math.max(1, ...Object.values(data?.byDay || {}).map(Number));

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Inbound/outbound, answer rates, bookings, transfers, sentiment, and cost."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="">All directions</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Outcome filter"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
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
        <StatCard label="No-answer rate" value={`${Math.round((data?.noAnswerRate ?? 0) * 100)}%`} />
        <StatCard label="Failure rate" value={`${Math.round((data?.failureRate ?? 0) * 100)}%`} />
        <StatCard label="Voicemail rate" value={`${Math.round((data?.voicemailRate ?? 0) * 100)}%`} />
        <StatCard label="Transfer rate" value={`${Math.round((data?.transferRate ?? 0) * 100)}%`} />
        <StatCard
          label="Successful transfer"
          value={`${Math.round((data?.successfulTransferRate ?? 0) * 100)}%`}
        />
        <StatCard label="Qualified rate" value={`${Math.round((data?.qualifiedRate ?? 0) * 100)}%`} />
        <StatCard label="Appointment rate" value={`${Math.round((data?.appointmentRate ?? 0) * 100)}%`} />
        <StatCard
          label="Avg duration"
          value={`${Math.round(data?.avgDurationSeconds ?? 0)}s`}
        />
        <StatCard label="Inbound" value={formatNumber(data?.inbound ?? 0)} />
        <StatCard label="Outbound" value={formatNumber(data?.outbound ?? 0)} />
        <StatCard label="AI minutes" value={data?.aiMinutes?.toFixed(1) ?? "0"} />
        <StatCard label="Telephony minutes" value={data?.telephonyMinutes?.toFixed(1) ?? "0"} />
        <StatCard
          label="Cost / call"
          value={`$${((data?.costPerCall ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Cost / qualified"
          value={`$${((data?.costPerQualifiedLead ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Cost / appointment"
          value={`$${((data?.costPerAppointment ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Total cost"
          value={`$${((data?.totalCostCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Model cost"
          value={`$${((data?.modelCostCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Transcription cost"
          value={`$${((data?.transcriptionCostCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          label="Tool success"
          value={`${Math.round((data?.toolSuccessRate ?? 0) * 100)}%`}
        />
        <StatCard label="Tool failures" value={formatNumber(data?.toolFailures ?? 0)} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-medium">Calls per day</h2>
          <div className="flex h-32 items-end gap-1">
            {Object.entries(data?.byDay || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, count]) => (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="min-h-[2px] w-full rounded-t bg-blue-500"
                    style={{ height: `${(Number(count) / maxDay) * 100}%` }}
                    title={`${day}: ${count}`}
                  />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">
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
          <h2 className="mb-4 font-medium">Outcomes</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(data?.outcomes || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-1">
                <span>{k}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
            {!Object.keys(data?.outcomes || {}).length && (
              <li className="text-muted-foreground">No outcomes yet</li>
            )}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium">Sentiment</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(data?.sentimentCounts || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-1">
                <span className="capitalize">{k}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium">Campaign performance</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(data?.byCampaign || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-1">
                <span className="truncate">{k}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
            {!Object.keys(data?.byCampaign || {}).length && (
              <li className="text-muted-foreground">No campaign calls yet</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
