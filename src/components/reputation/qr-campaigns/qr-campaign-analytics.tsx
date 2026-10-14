"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Loader2 } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { QrKpiCard, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import type { QrCampaignAnalytics } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = [7, 30, 90] as const;

const DEVICE_COLORS = {
  mobile: "#16A34A",
  desktop: "#2563EB",
  tablet: "#7C3AED",
  other: "#98A2B3",
} as const;

export function QrCampaignAnalyticsView({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QrCampaignAnalytics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessId,
        days: String(days),
      });
      const res = await fetch(
        `/api/reputation/qr-campaigns/${campaignId}/analytics?${params}`
      );
      const json = (await res.json()) as QrCampaignAnalytics & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(1, ...data.daily.map((d) => d.totalScans));
  }, [data]);

  const deviceTotal = useMemo(() => {
    if (!data) return 1;
    const b = data.deviceBreakdown;
    return Math.max(1, b.mobile + b.desktop + b.tablet + b.other);
  }, [data]);

  const deviceSegments = useMemo(() => {
    if (!data) return [];
    const b = data.deviceBreakdown;
    return (
      [
        ["Mobile", b.mobile, DEVICE_COLORS.mobile],
        ["Desktop", b.desktop, DEVICE_COLORS.desktop],
        ["Tablet", b.tablet, DEVICE_COLORS.tablet],
        ["Other", b.other, DEVICE_COLORS.other],
      ] as const
    ).filter(([, count]) => count > 0);
  }, [data]);

  const ratioLabel =
    data?.estimatedScanToReviewRatio != null
      ? `${(data.estimatedScanToReviewRatio * 100).toFixed(1)}%`
      : "—";

  const linePoints = useMemo(() => {
    if (!data?.daily?.length) return "";
    const w = 100;
    const h = 40;
    const pts = data.daily.map((d, i) => {
      const x = data.daily.length === 1 ? w / 2 : (i / (data.daily.length - 1)) * w;
      const y = h - (d.totalScans / maxDaily) * (h - 4) - 2;
      return `${x},${y}`;
    });
    return pts.join(" ");
  }, [data, maxDaily]);

  return (
    <ModulePage className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns/${campaignId}`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <h1 className={qrUi.title}>QR Analytics</h1>
          <p className={qrUi.subtitle}>
            {data?.campaign?.name
              ? `Scan activity for “${data.campaign.name}”.`
              : "Scan activity for this tracked QR campaign."}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1 shadow-sm">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                days === d
                  ? "bg-[#16A34A] text-white shadow-sm"
                  : "text-[#475467] hover:bg-[#F9FAFB]"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
          Loading analytics…
        </div>
      ) : error ? (
        <div className={cn(qrUi.cardPad, "border-dashed text-center")}>
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void load()} className={cn(qrUi.btnSecondary, "mt-4")}>
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          {/* Story hero — what the owner actually cares about */}
          <div className="overflow-hidden rounded-[1.5rem] border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_55%,#F0FDF4_100%)] p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
              Review growth story · last {days} days
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StoryStat
                value={data.totalScans.toLocaleString()}
                label="people scanned"
              />
              <StoryStat
                value={data.estimatedUniqueScans.toLocaleString()}
                label="unique visitors"
              />
              <StoryStat
                value={
                  data.newReviewsInPeriod == null
                    ? "—"
                    : data.newReviewsInPeriod.toLocaleString()
                }
                label="reviews added in that period"
              />
              <StoryStat
                value={ratioLabel}
                label="visitor → review correlation"
                emphasize
              />
            </div>
            <div className="mt-5 flex gap-2 rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] px-4 py-3 text-sm text-[#175CD3]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {data.correlationNote ||
                  "Review counts are correlation in the same window — not verified attribution from each scan."}
              </p>
            </div>
          </div>

          <div className={cn(qrUi.cardPad)}>
            <p className={qrUi.label}>Funnel detail</p>
            <div className="mt-4 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <QrKpiCard label="Total scans" value={data.totalScans.toLocaleString()} />
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-[#98A2B3] lg:block" />
              <div className="flex-1">
                <QrKpiCard
                  label="Estimated unique"
                  value={data.estimatedUniqueScans.toLocaleString()}
                  hint="Approximate unique visitors"
                />
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-[#98A2B3] lg:block" />
              <div className="flex-1">
                <QrKpiCard
                  label="New reviews (correlated)"
                  value={
                    data.newReviewsInPeriod == null
                      ? "—"
                      : data.newReviewsInPeriod.toLocaleString()
                  }
                  hint="Same window — not proven from QR"
                />
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-[#98A2B3] lg:block" />
              <div className="flex-1">
                <QrKpiCard
                  label="Scan → review ratio"
                  value={ratioLabel}
                  hint="Correlation only — not exact attribution"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Daily scans chart */}
            <div className={cn(qrUi.cardPad)}>
              <h2 className="text-base font-bold text-[#0B1B32]">Daily scans</h2>
              <p className="mt-0.5 text-xs text-[#667085]">
                Bars show total counted scans per day in the selected window.
              </p>
              {data.daily.length === 0 ? (
                <p className="mt-8 text-center text-sm text-[#667085]">No daily stats yet.</p>
              ) : (
                <div className="relative mt-5">
                  <svg
                    viewBox="0 0 100 44"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-x-0 top-0 h-44 w-full opacity-40"
                    aria-hidden
                  >
                    <polyline
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="0.8"
                      points={linePoints}
                    />
                  </svg>
                  <div className="relative flex h-44 items-end gap-1 overflow-x-auto pb-1">
                    {data.daily.map((d) => (
                      <div
                        key={d.date}
                        className="flex min-w-[20px] flex-1 flex-col items-center justify-end gap-1"
                        title={`${d.date}: ${d.totalScans} scans, ~${d.estimatedUniqueScans} unique`}
                      >
                        <span className="text-[9px] font-semibold text-[#667085]">
                          {d.totalScans || ""}
                        </span>
                        <div
                          className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-[#15803D] to-[#16A34A]"
                          style={{
                            height: `${Math.max(6, (d.totalScans / maxDaily) * 100)}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-[#98A2B3]">
                    <span>{data.daily[0]?.date}</span>
                    <span>{data.daily[data.daily.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Device breakdown */}
            <div className={cn(qrUi.cardPad)}>
              <h2 className="text-base font-bold text-[#0B1B32]">Device breakdown</h2>
              <p className="mt-0.5 text-xs text-[#667085]">Counted scans in the selected period</p>

              {/* Segmented bar */}
              <div className="mt-5 flex h-4 overflow-hidden rounded-full">
                {deviceSegments.map(([label, count, color]) => (
                  <div
                    key={label}
                    style={{
                      width: `${(count / deviceTotal) * 100}%`,
                      backgroundColor: color,
                    }}
                    title={`${label}: ${count}`}
                  />
                ))}
              </div>

              <ul className="mt-5 space-y-3">
                {(
                  [
                    ["Mobile", data.deviceBreakdown.mobile, DEVICE_COLORS.mobile],
                    ["Desktop", data.deviceBreakdown.desktop, DEVICE_COLORS.desktop],
                    ["Tablet", data.deviceBreakdown.tablet, DEVICE_COLORS.tablet],
                    ["Other", data.deviceBreakdown.other, DEVICE_COLORS.other],
                  ] as const
                ).map(([label, count, color]) => (
                  <li key={label}>
                    <div className="mb-1 flex justify-between text-xs text-[#475467]">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {label}
                      </span>
                      <span>
                        {count.toLocaleString()} ({Math.round((count / deviceTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / deviceTotal) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent activity */}
          <div className={cn(qrUi.cardPad)}>
            <h2 className="text-base font-bold text-[#0B1B32]">Recent activity</h2>
            <p className="mt-0.5 text-xs text-[#667085]">Period snapshot for this campaign</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <dt className={qrUi.label}>Scans today</dt>
                <dd className="mt-2 text-2xl font-bold text-[#0B1B32]">{data.scansToday}</dd>
              </div>
              <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <dt className={qrUi.label}>Last 7 days</dt>
                <dd className="mt-2 text-2xl font-bold text-[#0B1B32]">{data.scans7d}</dd>
              </div>
              <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <dt className={qrUi.label}>In period</dt>
                <dd className="mt-2 text-2xl font-bold text-[#0B1B32]">{data.scans30d}</dd>
              </div>
              <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <dt className={qrUi.label}>Prev. period</dt>
                <dd className="mt-2 text-2xl font-bold text-[#0B1B32]">
                  {data.previousPeriodScans}
                </dd>
              </div>
            </dl>
          </div>
        </>
      ) : null}
    </ModulePage>
  );
}

function StoryStat({
  value,
  label,
  emphasize = false,
}: {
  value: string;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/80 px-4 py-4",
        emphasize ? "border-[#16A34A] shadow-[0_0_0_1px_rgba(22,163,74,0.15)]" : "border-[#E6EAF0]"
      )}
    >
      <p className="text-3xl font-extrabold tracking-tight text-[#0B1B32]">{value}</p>
      <p className="mt-1 text-sm font-medium text-[#486581]">{label}</p>
    </div>
  );
}
