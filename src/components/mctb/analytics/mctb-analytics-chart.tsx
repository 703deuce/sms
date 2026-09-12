"use client";

import {
  chartAxisLabelIndices,
  formatChartAxisDate,
} from "@/lib/mctb/analytics-range";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { formatNumber } from "@/lib/utils";
import { useMemo, useState } from "react";

type Point = { date: string; count: number };

export function MctbAnalyticsChart({
  title,
  total,
  series,
  range,
  metricName,
  emptyMessage = "No activity in this period.",
  hrefForDate,
  compact = false,
}: {
  title: string;
  total: number;
  series: Point[];
  range: MctbAnalyticsRange;
  metricName: string;
  emptyMessage?: string;
  hrefForDate?: (iso: string) => string;
  compact?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...series.map((p) => p.count)), [series]);
  const allZero = total === 0;
  const labelIndices = useMemo(
    () => new Set(chartAxisLabelIndices(series.length, range)),
    [series.length, range],
  );

  return (
    <section
      className={`mctb-analytics-chart${compact ? " mctb-analytics-chart--compact" : ""}`}
      aria-label={title}
    >
      <div className="mctb-analytics-chart__head">
        <h2 className="mctb-analytics-chart__title">{title}</h2>
        <p className="mctb-analytics-chart__total">
          {formatNumber(total)} <span>total</span>
        </p>
      </div>

      {allZero ? (
        <p className="mctb-analytics-chart__empty">{emptyMessage}</p>
      ) : (
        <div className="mctb-analytics-chart__plot" role="img" aria-label={`${title} bar chart`}>
          {hover != null && series[hover] ? (
            <div className="mctb-analytics-chart__tooltip" role="tooltip">
              <div>{formatChartAxisDate(series[hover].date, range)}</div>
              <div>{metricName}</div>
              <div className="font-semibold">{series[hover].count}</div>
            </div>
          ) : null}
          <div className="mctb-analytics-chart__bars">
            {series.map((p, i) => {
              const barHref = hrefForDate?.(p.date);
              const inner = (
                <div
                  className={`mctb-analytics-chart__bar${hover === i ? " mctb-analytics-chart__bar--active" : ""}`}
                  style={{
                    height: p.count > 0 ? `${Math.max(4, (p.count / max) * 100)}%` : "0%",
                  }}
                />
              );
              return barHref ? (
                <a
                  key={p.date}
                  href={barHref}
                  className="mctb-analytics-chart__bar-cell"
                  aria-label={`${formatChartAxisDate(p.date, range)}: ${p.count} ${metricName}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {inner}
                </a>
              ) : (
                <button
                  key={p.date}
                  type="button"
                  className="mctb-analytics-chart__bar-cell"
                  aria-label={`${formatChartAxisDate(p.date, range)}: ${p.count} ${metricName}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {inner}
                </button>
              );
            })}
          </div>
          <div className="mctb-analytics-chart__axis">
            {series.map((p, i) => (
              <div key={p.date} className="mctb-analytics-chart__axis-cell">
                {labelIndices.has(i) ? (
                  <span>{formatChartAxisDate(p.date, range)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="sr-only">
        {series.map((p) => `${formatChartAxisDate(p.date, range)} ${p.count}`).join("; ")}
      </p>
    </section>
  );
}
