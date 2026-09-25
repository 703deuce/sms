"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type AnalyticsPayload = {
  periodDays: number;
  totalCalls: number;
  inbound: number;
  answerRate: number;
  appointmentRate: number;
  transferRate: number;
  successfulTransferRate: number;
  avgDurationSeconds: number;
  outcomes: Record<string, number>;
  byDay: Record<string, number>;
  voiceProduct?: {
    callbacksRequested: number;
    messagesTaken: number;
    emergenciesEscalated: number;
    transferAttempts: number;
    transferCompleted: number;
    transferFailed: number;
    appointmentsBooked: number;
    openKnowledgeGaps: number;
    spamOrSolicitorOutcomes: number;
  };
};

export function VoiceAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetch(`/api/voice/analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) setError(j.error || "Failed to load analytics");
        else setData(j.data);
      })
      .catch(() => setError("Failed to load analytics"));
  }, [days]);

  const vp = data?.voiceProduct;

  return (
    <div>
      <VoiceSubNav />
      <PageHeader
        title="Voice analytics"
        description="After-hours receptionist and voice call metrics for this workspace."
        actions={
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Date range"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total calls" value={formatNumber(data.totalCalls)} />
            <StatCard label="Inbound" value={formatNumber(data.inbound)} />
            <StatCard
              label="Answer rate"
              value={`${Math.round((data.answerRate || 0) * 100)}%`}
            />
            <StatCard
              label="Avg duration"
              value={`${Math.round(data.avgDurationSeconds || 0)}s`}
            />
          </div>

          {vp ? (
            <section className="mt-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Outcomes
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Callbacks" value={formatNumber(vp.callbacksRequested)} />
                <StatCard label="Messages taken" value={formatNumber(vp.messagesTaken)} />
                <StatCard label="Appointments booked" value={formatNumber(vp.appointmentsBooked)} />
                <StatCard label="Emergencies" value={formatNumber(vp.emergenciesEscalated)} />
                <StatCard label="Transfer attempts" value={formatNumber(vp.transferAttempts)} />
                <StatCard label="Transfers completed" value={formatNumber(vp.transferCompleted)} />
                <StatCard label="Transfers failed" value={formatNumber(vp.transferFailed)} />
                <StatCard label="Spam / solicitor" value={formatNumber(vp.spamOrSolicitorOutcomes)} />
              </div>
              {vp.openKnowledgeGaps > 0 ? (
                <Card className="mt-4 p-4 text-sm">
                  <Link href="/voice/knowledge#knowledge-gaps" className="font-medium text-primary underline">
                    {vp.openKnowledgeGaps} open knowledge gap{vp.openKnowledgeGaps === 1 ? "" : "s"}
                  </Link>
                  {" — review and add approved answers."}
                </Card>
              ) : null}
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Outcome breakdown
            </h2>
            <Card className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Outcome</th>
                    <th className="pb-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.outcomes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <tr key={k} className="border-t border-border">
                        <td className="py-2 pr-4 font-mono text-xs">{k}</td>
                        <td className="py-2">{v}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
