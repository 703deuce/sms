"use client";

import { Button } from "@/components/ui/button";
import { MctbStatCards } from "@/components/mctb/kimi-ui/mctb-stat-cards";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
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
import { useEffect, useMemo, useState } from "react";
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
    const eligible = Math.max(0, missed - mctb.suppressed);
    return [
      { label: "Missed calls", value: missed, href: `${MCTB_ROUTES.missedCalls}?date=${range}` },
      { label: "Recovery texts sent", value: mctb.textsSent, href: MCTB_ROUTES.missedCalls },
      { label: "Customers replied", value: mctb.replies, href: `${MCTB_ROUTES.conversations}?filter=replied` },
      { label: "Reply rate", value: `${mctb.replyRate}%`, href: MCTB_ROUTES.analytics },
    ];
  }, [mctb, range]);

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Analytics</h1>
            <p className="mt-1 text-[13.5px] text-gray-500">
              Recovery funnel, delivery health, and suppression — observable facts only.
            </p>
          </div>
          <div
            role="group"
            aria-label="Date range"
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-0.5 shadow-sm"
          >
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                  range === r ? "bg-primary text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        </div>

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
                { label: "Recovery texts sent", value: formatNumber(mctb?.textsSent ?? 0), icon: Send, tint: "blue", href: MCTB_ROUTES.missedCalls },
                { label: "Customers replied", value: formatNumber(mctb?.replies ?? 0), icon: MessageSquare, tint: "green", href: `${MCTB_ROUTES.conversations}?filter=replied` },
                { label: "Reply rate", value: `${mctb?.replyRate ?? 0}%`, icon: BarChart3, tint: "amber", href: MCTB_ROUTES.analytics },
              ]}
            />

            <div className="mt-5 ref-card p-5">
              <h2 className="text-[15px] font-bold text-gray-900">Recovery funnel</h2>
              <p className="mt-1 text-[12px] text-gray-500">Suppressed is distinct from failed delivery.</p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {funnel.map((step, i) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="block rounded-xl border border-gray-100 px-4 py-3 transition hover:border-indigo-200 hover:shadow-sm"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Step {i + 1}
                      </span>
                      <p className="mt-1 text-[13px] font-medium text-gray-700">{step.label}</p>
                      <p className="text-[20px] font-bold tabular-nums text-gray-900">{step.value}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="ref-card p-5">
                <h2 className="text-[15px] font-bold text-gray-900">Delivery & engagement</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                  <div><dt className="text-gray-500">Delivery rate</dt><dd className="font-semibold text-gray-900">{mctb?.deliveryRate ?? 0}%</dd></div>
                  <div><dt className="text-gray-500">Link clicks</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.linkClicks ?? 0)}</dd></div>
                  <div><dt className="text-gray-500">Delivery failures</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.deliveryFailures ?? 0)}</dd></div>
                  <div><dt className="text-gray-500">Opt-outs</dt><dd className="font-semibold text-gray-900">{formatNumber(mctb?.optOuts ?? 0)}</dd></div>
                </dl>
              </div>

              <div className="ref-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-gray-900">Voicemail</h2>
                  <Link href={`${MCTB_ROUTES.voicemail}?from=${range}`} className="text-[13px] font-semibold text-indigo-600 hover:underline">
                    Open inbox
                  </Link>
                </div>
                <p className="mt-2 flex items-center gap-2 text-[22px] font-bold text-gray-900">
                  <Voicemail className="h-5 w-5 text-indigo-600" aria-hidden />
                  {formatNumber(mctb?.voicemailCount ?? 0)}
                </p>
                <p className="text-[12px] text-gray-500">Voicemails in selected range</p>
              </div>
            </div>

            <div className="mt-5 ref-card p-5">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-amber-600" aria-hidden />
                <h2 className="text-[15px] font-bold text-gray-900">Why some callers weren&apos;t texted</h2>
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
