"use client";

import { MctbAnalyticsChart } from "@/components/mctb/analytics/mctb-analytics-chart";
import {
  analyticsRangeLabel,
  missedCallsDateFromAnalyticsRange,
} from "@/lib/mctb/analytics-range";
import {
  formatSuppressionReasonLabel,
  suppressionMissedCallsHref,
} from "@/lib/mctb/analytics-suppression-labels";
import { loadMctbAnalytics, type MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./mctb-analytics.css";

type MctbAnalytics = Awaited<ReturnType<typeof loadMctbAnalytics>>;

const RANGE_OPTIONS: Array<{ id: MctbAnalyticsRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

function parseRange(raw: string | null): MctbAnalyticsRange {
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return "30d";
}

export function MctbAnalyticsView({ initialData = null }: { initialData?: MctbAnalytics | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = useMemo(() => parseRange(searchParams.get("range")), [searchParams]);

  const [mctb, setMctb] = useState<MctbAnalytics | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
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
    if (initialData?.range === range) {
      setMctb(initialData);
      setLoading(false);
      setError(false);
      return;
    }
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
  }, [initialData, range]);

  const rangeLabel = analyticsRangeLabel(range);
  const missedDate = missedCallsDateFromAnalyticsRange(range);

  const suppressionRows = useMemo(() => {
    const entries = Object.entries(mctb?.suppressionByReason ?? {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    return entries.slice(0, 12).map(([reason, count]) => ({
      reason,
      label: formatSuppressionReasonLabel(reason),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      href: suppressionMissedCallsHref(reason, missedDate),
    }));
  }, [mctb?.suppressionByReason, missedDate]);

  const missedCallsHref = `${MCTB_ROUTES.missedCalls}?date=${missedDate}`;
  const conversationsHref = `${MCTB_ROUTES.conversations}?filter=replied`;

  return (
    <div className="mctb-analytics">
      <div className="mctb-analytics-inner">
        <header className="mctb-analytics-header">
          <div>
            <h1 className="mctb-analytics-title">Analytics</h1>
            <p className="mctb-analytics-desc">
              Recovery performance, delivery health, replies, and suppression reasons.
            </p>
          </div>
          <div className="mctb-analytics-range" role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={range === opt.id}
                onClick={() => setRange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="mctb-analytics-skel h-16" />
            <div className="mctb-analytics-skel h-24" />
            <div className="mctb-analytics-grid mctb-analytics-grid--charts-2">
              <div className="mctb-analytics-skel h-64" />
              <div className="mctb-analytics-skel h-64" />
            </div>
          </div>
        ) : error ? (
          <div className="mctb-analytics-panel p-6 text-center text-[13px]">
            <p>Unable to load analytics.</p>
            <button
              type="button"
              className="mt-3 text-[13px] font-medium underline"
              onClick={() => setRange(range)}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mctb-analytics-metrics">
              <Link href={missedCallsHref} className="mctb-analytics-metric">
                <div className="mctb-analytics-metric-label">Missed calls</div>
                <div className="mctb-analytics-metric-value">
                  {formatNumber(mctb?.totalMissed ?? 0)}
                </div>
                <div className="mctb-analytics-metric-sub">{rangeLabel}</div>
              </Link>
              <Link href={missedCallsHref} className="mctb-analytics-metric">
                <div className="mctb-analytics-metric-label">Recovery texts</div>
                <div className="mctb-analytics-metric-value">
                  {formatNumber(mctb?.textsSent ?? 0)}
                </div>
                <div className="mctb-analytics-metric-sub">{rangeLabel}</div>
              </Link>
              <Link href={conversationsHref} className="mctb-analytics-metric">
                <div className="mctb-analytics-metric-label">Customers replied</div>
                <div className="mctb-analytics-metric-value">
                  {formatNumber(mctb?.replies ?? 0)}
                </div>
                <div className="mctb-analytics-metric-sub">{rangeLabel}</div>
              </Link>
              <div className="mctb-analytics-metric">
                <div className="mctb-analytics-metric-label">Reply rate</div>
                <div className="mctb-analytics-metric-value">{mctb?.replyRate ?? 0}%</div>
                <div className="mctb-analytics-metric-sub">Sent → replied</div>
              </div>
            </div>

            <section className="mctb-analytics-funnel" aria-label="Recovery funnel">
              <h2>Recovery funnel</h2>
              <p className="mctb-analytics-funnel-note">
                Suppressed and ineligible events are excluded from recovery sends.
              </p>
              <div className="mctb-analytics-funnel-steps">
                <div className="mctb-analytics-funnel-step">
                  Missed calls
                  <strong>{formatNumber(mctb?.totalMissed ?? 0)}</strong>
                </div>
                <div className="mctb-analytics-funnel-step">
                  Recovery texts
                  <strong>{formatNumber(mctb?.textsSent ?? 0)}</strong>
                </div>
                <div className="mctb-analytics-funnel-step">
                  Customers replied
                  <strong>{formatNumber(mctb?.replies ?? 0)}</strong>
                </div>
                <div className="mctb-analytics-funnel-step">
                  Reply rate
                  <strong>{mctb?.replyRate ?? 0}%</strong>
                </div>
              </div>
            </section>

            {mctb?.trends ? (
              <div className="mctb-analytics-grid mctb-analytics-grid--charts-2 mb-3">
                <MctbAnalyticsChart
                  title="Missed calls over time"
                  total={mctb.totalMissed}
                  series={mctb.trends.missedCalls}
                  range={range}
                  metricName="Missed calls"
                  hrefForDate={() => missedCallsHref}
                />
                <MctbAnalyticsChart
                  title="Recovery texts over time"
                  total={mctb.textsSent}
                  series={mctb.trends.recoveryTexts}
                  range={range}
                  metricName="Recovery texts"
                  hrefForDate={() => missedCallsHref}
                />
              </div>
            ) : null}

            <div className="mctb-analytics-grid mctb-analytics-grid--7-5 mb-3">
              {mctb?.trends ? (
                <MctbAnalyticsChart
                  title="Replies over time"
                  total={mctb.replies}
                  series={mctb.trends.replies}
                  range={range}
                  metricName="Replies"
                  emptyMessage="No replies in this period."
                  hrefForDate={() => conversationsHref}
                />
              ) : null}
              <div className="mctb-analytics-panel mctb-analytics-delivery min-h-[15rem]">
                <h2>Delivery &amp; engagement</h2>
                <dl>
                  <div>
                    <dt>Delivery rate</dt>
                    <dd>{mctb?.deliveryRate ?? 0}%</dd>
                  </div>
                  <div>
                    <dt>Link clicks</dt>
                    <dd>{formatNumber(mctb?.linkClicks ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Delivery failures</dt>
                    <dd>{formatNumber(mctb?.deliveryFailures ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Opt-outs</dt>
                    <dd>{formatNumber(mctb?.optOuts ?? 0)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mctb-analytics-grid mctb-analytics-grid--8-4">
              <section className="mctb-analytics-panel mctb-analytics-suppression">
                <h2>Why some callers weren&apos;t texted</h2>
                {suppressionRows.length === 0 ? (
                  <p className="text-[13px] text-[#626872]">No suppressions in this period.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Reason</th>
                        <th scope="col">Count</th>
                        <th scope="col">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppressionRows.map((row) => (
                        <tr key={row.reason}>
                          <td>
                            <Link href={row.href}>{row.label}</Link>
                          </td>
                          <td>
                            <Link href={row.href}>{row.count}</Link>
                          </td>
                          <td>{row.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="mctb-analytics-panel mctb-analytics-voicemail">
                <h2>Voicemail</h2>
                <div className="mctb-analytics-vm-count">
                  {formatNumber(mctb?.voicemailCount ?? 0)}
                </div>
                <p>Voicemails in selected range</p>
                <Link href={MCTB_ROUTES.voicemail}>Open voicemail →</Link>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
