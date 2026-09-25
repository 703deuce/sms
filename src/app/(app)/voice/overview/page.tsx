"use client";

import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { cn, formatNumber } from "@/lib/utils";
import { formatPhoneMinutes } from "@/lib/voice/phone-minutes";
import Link from "next/link";
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
  phoneMinutesToday: number;
  phoneMinutesYesterday: number;
  phoneMinutesDeltaPct: number | null;
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

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-xs font-medium text-muted-foreground">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        positive ? "text-violet-600" : "text-rose-500",
      )}
    >
      {positive ? "+" : ""}
      {value}% vs yesterday
    </span>
  );
}

export default function VoiceOverviewPage() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [days, setDays] = useState(1);

  useEffect(() => {
    fetch(`/api/voice/overview?days=${days}`)
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => undefined);
  }, [days]);

  const phoneMinutesLabel =
    days === 1
      ? "Phone minutes (today)"
      : `Phone minutes (${days}d)`;

  return (
    <div>
      <PageHeader
        title="AI Voice overview"
        description="Live metrics for agents, phone calls, campaigns, and usage."
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/voice/calls", label: "Calls", hint: "History & detail" },
          { href: "/voice/call-handling", label: "Call Handling", hint: "Transfers & on-call" },
          { href: "/voice/knowledge", label: "Knowledge", hint: "FAQ & gaps" },
          { href: "/voice/needs-attention", label: "Needs attention", hint: "Follow-ups" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40"
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
          </Link>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-violet-200/80 bg-violet-50/40 px-4 py-3 text-sm text-slate-600">
        <strong className="font-semibold text-slate-800">Phone minutes</strong> count live talk
        time on real inbound/outbound calls (PSTN/LiveKit). Browser voice tests and TTS-only
        sessions are excluded.
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Phone min — today"
          value={`${formatPhoneMinutes(stats?.phoneMinutesToday ?? 0)}`}
          hint={`${formatNumber(stats?.callsToday ?? 0)} calls`}
        />
        <StatCard
          label="Phone min — yesterday"
          value={`${formatPhoneMinutes(stats?.phoneMinutesYesterday ?? 0)}`}
          hint={<DeltaBadge value={stats?.phoneMinutesDeltaPct ?? null} />}
        />
        <StatCard label="Calls today" value={formatNumber(stats?.callsToday ?? 0)} />
        <StatCard
          label={phoneMinutesLabel}
          value={stats?.aiMinutesUsed?.toFixed(1) ?? "0"}
        />
        <StatCard label="Active agents" value={formatNumber(stats?.activeAgents ?? 0)} />
        <StatCard label="Answer rate" value={`${Math.round((stats?.answerRate ?? 0) * 100)}%`} />
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
                  <TD>
                    <Link href={`/voice/calls/${c.id}`} className="text-primary hover:underline">
                      {c.status}
                    </Link>
                  </TD>
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
