"use client";

import { useMemo, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";

function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type SeriesPoint = { date: string; count: number };

export function MctbRecoveryTrendChart({
  title,
  subtitle,
  series,
  rangeDays,
  valueLabel,
}: {
  title: string;
  subtitle: string;
  series: SeriesPoint[];
  rangeDays: number;
  valueLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...series.map((p) => p.count)), [series]);
  const total = useMemo(() => series.reduce((acc, p) => acc + p.count, 0), [series]);
  const labelEvery = rangeDays >= 30 ? 5 : rangeDays >= 14 ? 3 : 1;

  return (
    <div className="ref-deco-chart p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-[12px] text-gray-500">{subtitle}</p>
        </div>
        <p className="text-sm font-semibold text-gray-900">
          {formatNumber(total)}{" "}
          <span className="text-xs font-medium text-gray-500">{valueLabel}</span>
        </p>
      </div>

      <div className="relative mt-5" role="img" aria-label={`${title} trend chart`}>
        {hover != null && series[hover] ? (
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm">
            {formatSeriesDate(series[hover].date)} · {series[hover].count}
          </div>
        ) : null}
        <div className="flex h-44 items-end gap-[3px]">
          {series.map((p, i) => (
            <button
              key={p.date}
              type="button"
              aria-label={`${formatSeriesDate(p.date)}: ${p.count}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group flex h-full flex-1 items-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <div
                className={cn(
                  "w-full rounded-t-[3px] transition-colors",
                  hover === i ? "bg-primary shadow-[0_0_12px_rgba(79,70,229,0.35)]" : "bg-indigo-200/90",
                )}
                style={{ height: `${Math.max(3, (p.count / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-[3px]">
          {series.map((p, i) => (
            <div key={p.date} className="flex-1 text-center">
              {i % labelEvery === 0 ? (
                <span className="text-[10px] font-medium text-gray-500">
                  {formatSeriesDate(p.date)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only">
        Daily totals:{" "}
        {series.map((p) => `${formatSeriesDate(p.date)} ${p.count}`).join("; ")}
      </p>
    </div>
  );
}
