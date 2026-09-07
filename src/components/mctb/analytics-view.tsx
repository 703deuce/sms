"use client";

import { MctbPageHeader } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import { MctbRecoveryTrendChart } from "@/components/mctb/kimi-ui/mctb-recovery-trend-chart";
import { MctbStatCards } from "@/components/mctb/kimi-ui/mctb-stat-cards";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { formatNumber } from "@/lib/utils";
import {
  BarChart3,
  MessageSquare,
  PhoneMissed,
  Send,
  ShieldOff,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./kimi-ui/reference.css";

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
  trends?: {
    missedCalls: Array<{ date: string; count: number }>;
    recoveryTexts: Array<{ date: string; count: number }>;
    replies: Array<{ date: string; count: number }>;
  };
};

const RANGE_OPTIONS: Array<{ id: MctbAnalyticsRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

function parseRange(raw: string | null): MctbAnalyticsRange {
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return "30d";
}

function rangeDays(range: MctbAnalyticsRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

export function MctbAnalyticsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = useMemo(
    () => parseRange(searchParams.get("range")),
    [searchParams],
  );

  const [mctb, setMctb] = useState<MctbAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const setRange = useCallback(
    (next: MctbAnalyticsRange) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      router.push(`${MCTB_ROUTES.analytics}?${params.toString()}`);
    },
    [router, searchParams],
  );

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

  const topSuppressions = useMemo(
    () =>
      Object.entries(mctb?.suppressionByReason ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [mctb?.suppressionByReason],
  );

  const funnel = useMemo(() => {
    if (!mctb) return [];
    const missed = mctb.totalMissed || 0;
    return [
      { label: "Missed calls", value: missed, href: `${MCTB_ROUTES.missedCalls}?date=${range}` },
      { label: "Recovery texts sent", value: mctb.textsSent, href: `${MCTB_ROUTES.missedCalls}?date=${range}` },
      { label: "Customers replied", value: mctb.replies, href: `${MCTB_ROUTES.conversations}?filter=replied&product=mctb` },
      { label: "Reply rate", value: `${mctb.replyRate}%`, href: `${MCTB_ROUTES.analytics}?range=${range}` },
    ];
  }, [mctb, range]);

  const days = rangeDays(range);

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner">
        <MctbPageHeader
          title="Analytics"
          description="Recovery funnel, delivery health, and suppression — observable facts only."
          action={
            <div
              role="group"
              aria-label="Date range"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white/90 p-0.5 shadow-[0_2px_8px_rgba(79,70,229,0.06)] backdrop-blur-sm"
            >
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRange(opt.id)}
                  aria-pressed={range === opt.id}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                    range === opt.id ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ref-card h-24 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="ref-card p-8 text-center">
            <p className="font-medium text-gray-900">Analytics couldn&apos;t be loaded.</p>
          </div>
        ) : (
          <>
            <MctbStatCards
              stats={[
                { label: "Missed calls", value: formatNumber(mctb?.totalMissed ?? 0), icon: PhoneMissed, tint: "purple", href: `${MCTB_ROUTES.missedCalls}?date=${range}` },
                { label: "Recovery texts sent", value: formatNumber(mctb?.textsSent ?? 0), icon: Send, tint: "blue", href: `${MCTB_ROUTES.missedCalls}?date=${range}` },
                { label: "Customers replied", value: formatNumber(mctb?.replies ?? 0), icon: MessageSquare, tint: "green", href: `${MCTB_ROUTES.conversations}?filter=replied&product=mctb` },
                { label: "Reply rate", value: `${mctb?.replyRate ?? 0}%`, icon: BarChart3, tint: "amber", href: `${MCTB_ROUTES.analytics}?range=${range}` },
              ]}
            />

            <div className="mt-5 ref-deco-section ref-deco-section--tint-purple">
              <div className="ref-deco-section-head">
                <div className="flex items-center gap-2.5">
                  <span className="ref-deco-section-accent" aria-hidden />
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900">Recovery funnel</h2>
                    <p className="mt-0.5 text-[12px] text-gray-500">Suppressed is distinct from failed delivery.</p>
                  </div>
                </div>
              </div>
              <div className="ref-deco-section-body">
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {funnel.map((step, i) => (
                  <li key={step.label}>
                    <Link href={step.href} className="ref-deco-funnel-step">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
                        Step {i + 1}
                      </span>
                      <p className="mt-1 text-[13px] font-medium text-gray-700">{step.label}</p>
                      <p className="text-[20px] font-bold tabular-nums text-gray-900">{step.value}</p>
                    </Link>
                  </li>
                ))}
              </ol>
              </div>
            </div>

            {mctb?.trends ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <MctbRecoveryTrendChart
                  title="Missed calls over time"
                  subtitle={`Missed-call events per day · last ${days} days`}
                  series={mctb.trends.missedCalls}
                  rangeDays={days}
                  valueLabel="total"
                />
                <MctbRecoveryTrendChart
                  title="Recovery texts over time"
                  subtitle={`Recovery texts sent per day · last ${days} days`}
                  series={mctb.trends.recoveryTexts}
                  rangeDays={days}
                  valueLabel="total"
                />
                <MctbRecoveryTrendChart
                  title="Replies over time"
                  subtitle={`Customer replies per day · last ${days} days`}
                  series={mctb.trends.replies}
                  rangeDays={days}
                  valueLabel="total"
                />
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="ref-deco-section">
                <div className="ref-deco-section-head">
                  <div className="flex items-center gap-2.5">
                    <span className="ref-deco-section-accent ref-deco-section-accent--blue" aria-hidden />
                    <h2 className="text-[15px] font-bold text-gray-900">Delivery & engagement</h2>
                  </div>
                </div>
                <div className="ref-deco-section-body">
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div><dt className="text-gray-500">Delivery rate</dt><dd className="font-semibold text-gray-900">{mctb?.deliveryRate ?? 0}%</dd></div>
                  <div><dt className="text-gray-500">Link clicks</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.linkClicks ?? 0)}</dd></div>
                  <div><dt className="text-gray-500">Delivery failures</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.deliveryFailures ?? 0)}</dd></div>
                  <div><dt className="text-gray-500">Opt-outs</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.optOuts ?? 0)}</dd></div>
                </dl>
                </div>
              </div>

              <div className="ref-deco-section ref-deco-section--tint-blue">
                <div className="ref-deco-section-head">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="ref-deco-section-accent ref-deco-section-accent--blue" aria-hidden />
                      <h2 className="text-[15px] font-bold text-gray-900">Voicemail</h2>
                    </div>
                    <Link href={`${MCTB_ROUTES.voicemail}?from=${range}`} className="text-[13px] font-semibold text-indigo-600 hover:underline">
                      Open inbox
                    </Link>
                  </div>
                </div>
                <div className="ref-deco-section-body">
                <p className="mt-2 flex items-center gap-2 text-[22px] font-bold text-gray-900">
                  <Voicemail className="h-5 w-5 text-indigo-600" aria-hidden />
                  {formatNumber(mctb?.voicemailCount ?? 0)}
                </p>
                <p className="text-[12px] text-gray-500">Voicemails in selected range</p>
                </div>
              </div>
            </div>

            <div className="mt-5 ref-deco-section ref-deco-section--tint-amber">
              <div className="ref-deco-section-head">
                <div className="flex items-center gap-2.5">
                  <ShieldOff className="h-4 w-4 text-amber-600" aria-hidden />
                  <h2 className="text-[15px] font-bold text-gray-900">Why some callers weren&apos;t texted</h2>
                </div>
              </div>
              <div className="ref-deco-section-body">
              {topSuppressions.length === 0 ? (
                <p className="mt-3 text-[13px] text-gray-500">No suppressions in this period.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topSuppressions.map(([reason, count]) => (
                    <li key={reason} className="flex items-center justify-between text-[13px]">
                      <span className="text-gray-700">{reason.replace(/_/g, " ").toLowerCase()}</span>
                      <Link
                        href={`${MCTB_ROUTES.missedCalls}?status=suppressed&date=${range}`}
                        className="font-semibold tabular-nums text-indigo-600 hover:underline"
                      >
                        {count}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
