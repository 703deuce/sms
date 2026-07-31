"use client";

import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { formatNumber } from "@/lib/utils";
import { useEffect, useState } from "react";

type Overview = {
  activeAgents: number;
  assignedNumbers: number;
  callsToday: number;
  inboundToday: number;
  outboundToday: number;
  answerRate: number;
  qualifiedLeads: number;
  appointmentsBooked: number;
  transfersCompleted: number;
  voicemailsDetected: number;
  aiMinutesUsed: number;
  monthlyCostCents: number;
  runningCampaigns: number;
  agentsWithErrors: number;
  recentCalls: Array<{
    id: string;
    direction: string;
    status: string;
    fromE164: string;
    toE164: string;
    startedAt: string;
  }>;
  recentFailures: Array<{ id: string; message: string; at: string }>;
};

export default function VoiceOverviewPage() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [days, setDays] = useState(1);

  useEffect(() => {
    fetch(`/api/voice/overview?days=${days}`)
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => undefined);
  }, [days]);

  return (
    <div>
      <PageHeader
        title="AI Voice overview"
        description="Live metrics for agents, calls, campaigns, usage, and issues requiring attention."
        actions={
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        }
      />
      <VoiceSubNav />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active agents" value={formatNumber(stats?.activeAgents ?? 0)} />
        <StatCard label="Calls today" value={formatNumber(stats?.callsToday ?? 0)} />
        <StatCard label="Answer rate" value={`${Math.round((stats?.answerRate ?? 0) * 100)}%`} />
        <StatCard label="AI minutes" value={stats?.aiMinutesUsed?.toFixed(1) ?? "0"} />
        <StatCard label="Qualified leads" value={formatNumber(stats?.qualifiedLeads ?? 0)} />
        <StatCard label="Appointments" value={formatNumber(stats?.appointmentsBooked ?? 0)} />
        <StatCard label="Running campaigns" value={formatNumber(stats?.runningCampaigns ?? 0)} />
        <StatCard
          label="Est. monthly cost"
          value={`$${((stats?.monthlyCostCents ?? 0) / 100).toFixed(2)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-3 font-medium">Recent calls</div>
          <Table>
            <THead>
              <TR>
                <TH>Direction</TH>
                <TH>From</TH>
                <TH>To</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {(stats?.recentCalls || []).map((c) => (
                <TR key={c.id}>
                  <TD>{c.direction}</TD>
                  <TD className="font-mono text-xs">{c.fromE164}</TD>
                  <TD className="font-mono text-xs">{c.toE164}</TD>
                  <TD>{c.status}</TD>
                </TR>
              ))}
              {!stats?.recentCalls?.length && (
                <TR><TD colSpan={4} className="text-muted-foreground">No calls yet.</TD></TR>
              )}
            </TBody>
          </Table>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-3 font-medium">Needs attention</div>
          <ul className="divide-y divide-border">
            {stats?.agentsWithErrors ? (
              <li className="px-5 py-3 text-sm text-amber-700">
                {stats.agentsWithErrors} agent(s) with configuration problems
              </li>
            ) : null}
            {(stats?.recentFailures || []).map((f) => (
              <li key={f.id} className="px-5 py-3 text-sm">
                <span className="text-rose-600">{f.message}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{f.at}</span>
              </li>
            ))}
            {!stats?.recentFailures?.length && !stats?.agentsWithErrors && (
              <li className="px-5 py-3 text-sm text-muted-foreground">All systems normal.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
