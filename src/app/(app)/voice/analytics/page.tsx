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
  conversationsStarted: number;
  replyRate: number;
  deliveryRate: number;
  consentRate: number;
  linkClicks: number;
  linkClickRate: number;
  voicemailCount: number;
  optOuts: number;
  deliveryFailures: number;
  suppressionByReason: Record<string, number>;
};

type SrAnalytics = {
  periodDays: number;
  callsRouted: number;
  answered: number;
  noAnswer: number;
  answerRate: number;
  outboundBusinessCallbacks: number;
  byFlow: Record<string, number>;
};

export default function UnifiedAnalyticsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [mctb, setMctb] = useState<MctbAnalytics | null>(null);
  const [sr, setSr] = useState<SrAnalytics | null>(null);
  const [hasMctb, setHasMctb] = useState(false);
  const [hasSr, setHasSr] = useState(false);
  const [flowNames, setFlowNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/platform/features", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const f = j.data;
        setHasMctb(Boolean(f?.mctb?.status === "ACTIVE"));
        setHasSr(Boolean(f?.smart_routing?.status === "ACTIVE"));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/mctb/analytics?range=30d", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setHasMctb(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (hasMctb) {
      fetch(`/api/mctb/analytics?range=${range}`)
        .then((r) => r.json())
        .then((j) => setMctb(j.data))
        .catch(() => undefined);
    }
  }, [range, hasMctb]);

  useEffect(() => {
    if (!hasSr || hasMctb) return;
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    fetch("/api/smart-routing/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const f of j.data?.flows ?? []) {
          if (f.id && f.name) map[f.id] = f.name;
        }
        setFlowNames(map);
      })
      .catch(() => undefined);
    fetch(`/api/smart-routing/analytics?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSr(j.data || null))
      .catch(() => setSr(null));
  }, [range, hasSr, hasMctb]);

  const topSuppressions = Object.entries(mctb?.suppressionByReason ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Missed call recovery performance — text-backs, consent, conversations, and delivery health."
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

      {hasMctb ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Missed Call Text Back</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Missed calls" value={formatNumber(mctb?.totalMissed ?? 0)} />
            <StatCard label="Text-backs triggered" value={formatNumber(mctb?.textsSent ?? 0)} />
            <StatCard label="Consent / send rate" value={`${mctb?.consentRate ?? 0}%`} />
            <StatCard label="Conversations started" value={formatNumber(mctb?.conversationsStarted ?? 0)} />
            <StatCard label="Customer replies" value={formatNumber(mctb?.replies ?? 0)} />
            <StatCard label="Reply rate" value={`${mctb?.replyRate ?? 0}%`} />
            <StatCard label="Delivery rate" value={`${mctb?.deliveryRate ?? 0}%`} />
            <StatCard label="Voicemails" value={formatNumber(mctb?.voicemailCount ?? 0)} />
            <StatCard label="Suppressed" value={formatNumber(mctb?.suppressed ?? 0)} />
            <StatCard label="Delivery failures" value={formatNumber(mctb?.deliveryFailures ?? 0)} />
            <StatCard label="Opt-outs" value={formatNumber(mctb?.optOuts ?? 0)} />
            <StatCard label="Link clicks" value={formatNumber(mctb?.linkClicks ?? 0)} />
          </div>

          {topSuppressions.length ? (
            <Card className="mt-4 p-4">
              <h3 className="text-sm font-semibold">Top suppression reasons</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {topSuppressions.map(([reason, count]) => (
                  <li key={reason}>
                    {reason.replace(/_/g, " ")}: {count}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <p className="mt-3 text-sm text-muted-foreground">
            <Link href="/voice/missed-calls" className="font-semibold text-primary hover:underline">
              View missed call log →
            </Link>
            {" · "}
            <Link href="/inbox" className="font-semibold text-primary hover:underline">
              Open conversations →
            </Link>
          </p>
        </section>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Enable Missed Call Text Back to see recovery analytics here.
        </p>
      )}

      {hasSr && !hasMctb ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-muted-foreground">Smart Routing (legacy)</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Calls routed" value={formatNumber(sr?.callsRouted ?? 0)} />
            <StatCard label="Answered" value={formatNumber(sr?.answered ?? 0)} />
            <StatCard label="Answer rate" value={`${sr?.answerRate ?? 0}%`} />
            <StatCard
              label="Business callbacks"
              value={formatNumber(sr?.outboundBusinessCallbacks ?? 0)}
            />
          </div>
          {Object.keys(sr?.byFlow ?? {}).length > 0 ? (
            <Card className="mt-4 p-4">
              <h3 className="text-sm font-semibold">By call flow</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(sr?.byFlow ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([flowId, count]) => (
                    <li key={flowId}>
                      {flowNames[flowId] ?? flowId}: {count}
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
