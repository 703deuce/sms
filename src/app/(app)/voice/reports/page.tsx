"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type MctbAnalytics = {
  range: string;
  totalMissed: number;
  textsSent: number;
  suppressed: number;
  uniqueCallers: number;
  repeatCallers: number;
  replies: number;
  replyRate: number;
  deliveryRate: number;
};

type SrAnalytics = {
  periodDays: number;
  callsRouted: number;
  answered: number;
  noAnswer: number;
  answerRate: number;
};

type VoiceAiAnalytics = {
  totalCalls: number;
  answerRate: number;
  qualifiedRate: number;
  appointmentRate: number;
};

/** Cross-product analytics — preserved for deep links and power users. */
export default function VoiceReportsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [mctb, setMctb] = useState<MctbAnalytics | null>(null);
  const [sr, setSr] = useState<SrAnalytics | null>(null);
  const [voiceAi, setVoiceAi] = useState<VoiceAiAnalytics | null>(null);
  const [showVoiceAi, setShowVoiceAi] = useState(false);

  useEffect(() => {
    fetch(`/api/mctb/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => setMctb(j.data))
      .catch(() => undefined);
    fetch(`/api/smart-routing/analytics?days=${range === "7d" ? 7 : range === "90d" ? 90 : 30}`)
      .then((r) => r.json())
      .then((j) => setSr(j.data))
      .catch(() => undefined);
  }, [range]);

  useEffect(() => {
    if (!showVoiceAi) return;
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    fetch(`/api/voice/analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j.data;
        if (d) {
          setVoiceAi({
            totalCalls: d.totalCalls ?? 0,
            answerRate: d.answerRate ?? 0,
            qualifiedRate: d.qualifiedRate ?? 0,
            appointmentRate: d.appointmentRate ?? 0,
          });
        }
      })
      .catch(() => undefined);
  }, [showVoiceAi, range]);

  return (
    <div>
      <PageHeader
        title="Overall Reports"
        description="Cross-product view of missed call recovery, routing, and optional voice AI metrics."
        actions={
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as "7d" | "30d" | "90d")}
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        }
      />

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Missed call recovery
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Missed calls" value={formatNumber(mctb?.totalMissed ?? 0)} />
          <StatCard label="Texts sent" value={formatNumber(mctb?.textsSent ?? 0)} />
          <StatCard label="Delivery rate" value={`${mctb?.deliveryRate ?? 0}%`} />
          <StatCard label="Reply rate" value={`${mctb?.replyRate ?? 0}%`} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/voice/analytics" className="font-semibold text-primary hover:underline">
            MCTB Analytics →
          </Link>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Smart Routing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Calls routed" value={formatNumber(sr?.callsRouted ?? 0)} />
          <StatCard label="Answered" value={formatNumber(sr?.answered ?? 0)} />
          <StatCard label="No answer" value={formatNumber(sr?.noAnswer ?? 0)} />
          <StatCard label="Answer rate" value={`${sr?.answerRate ?? 0}%`} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/smart-routing/analytics" className="font-semibold text-primary hover:underline">
            Smart Routing Analytics →
          </Link>
        </p>
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Voice AI agent metrics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Qualified leads, appointments, and AI call costs for receptionist agents.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => setShowVoiceAi((v) => !v)}
          >
            {showVoiceAi ? "Hide" : "Show"} voice AI metrics
          </button>
        </div>
        {showVoiceAi ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total AI calls" value={formatNumber(voiceAi?.totalCalls ?? 0)} />
            <StatCard
              label="Answer rate"
              value={`${Math.round((voiceAi?.answerRate ?? 0) * 100)}%`}
            />
            <StatCard
              label="Qualified rate"
              value={`${Math.round((voiceAi?.qualifiedRate ?? 0) * 100)}%`}
            />
            <StatCard
              label="Appointment rate"
              value={`${Math.round((voiceAi?.appointmentRate ?? 0) * 100)}%`}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
