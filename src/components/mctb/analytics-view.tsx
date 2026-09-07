"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
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

export function MctbAnalyticsView() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [mctb, setMctb] = useState<MctbAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/mctb/analytics?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) throw new Error("missing data");
        setMctb(j.data);
      })
      .catch(() => {
        setError(true);
        setMctb(null);
      })
      .finally(() => setLoading(false));
  }, [range]);

  const topSuppressions = Object.entries(mctb?.suppressionByReason ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Analytics"
        description="Missed call recovery performance — text-backs, replies, suppression, and delivery health."
        actions={
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as "7d" | "30d" | "90d")}
            aria-label="Date range"
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm font-medium">Analytics couldn&apos;t be loaded.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Missed calls" value={formatNumber(mctb?.totalMissed ?? 0)} />
            <StatCard label="Recovery texts sent" value={formatNumber(mctb?.textsSent ?? 0)} />
            <StatCard label="Customers replied" value={formatNumber(mctb?.replies ?? 0)} />
            <StatCard label="Reply rate" value={`${mctb?.replyRate ?? 0}%`} />
            <StatCard label="Delivery rate" value={`${mctb?.deliveryRate ?? 0}%`} />
            <StatCard label="Voicemails" value={formatNumber(mctb?.voicemailCount ?? 0)} />
            <StatCard label="Suppressed" value={formatNumber(mctb?.suppressed ?? 0)} />
            <StatCard label="Delivery failures" value={formatNumber(mctb?.deliveryFailures ?? 0)} />
            <StatCard label="Opt-outs" value={formatNumber(mctb?.optOuts ?? 0)} />
            <StatCard label="Link clicks" value={formatNumber(mctb?.linkClicks ?? 0)} />
          </div>

          {topSuppressions.length ? (
            <Card className="mt-6 p-4">
              <h2 className="text-sm font-semibold">Why some callers weren&apos;t texted</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {topSuppressions.map(([reason, count]) => (
                  <li key={reason}>
                    {reason.replace(/_/g, " ")}: {count}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <p className="mt-4 text-sm text-muted-foreground">
            <Link href={MCTB_ROUTES.missedCalls} className="font-semibold text-primary hover:underline">
              View missed calls →
            </Link>
            {" · "}
            <Link href={MCTB_ROUTES.conversations} className="font-semibold text-primary hover:underline">
              Open conversations →
            </Link>
            {" · "}
            <Link href={MCTB_ROUTES.voicemail} className="font-semibold text-primary hover:underline">
              Voicemail →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
