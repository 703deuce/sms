"use client";

import { cn } from "@/lib/utils";

export function PersonalMockSparkline({
  points,
  color = "#6366f1",
  width = 64,
  height = 24,
  className,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

type LineSeries = { label: string; color: string; values: number[] };

export function PersonalMockLineChart({
  labels,
  series,
  height = 200,
  className,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(5, ...series.flatMap((s) => s.values));
  const step = Math.ceil(max / 4);
  const ticks = [0, step, step * 2, step * 3, step * 4];
  const w = labels.length;
  const chartH = height - 32;

  function pathFor(values: number[]) {
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 100 - (v / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] font-medium text-[#6b7280]">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div
          className="flex flex-col justify-between text-[11px] tabular-nums text-[#9ca3af]"
          style={{ height: chartH }}
        >
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{t}</span>
            ))}
        </div>
        <div className="relative flex-1 border-b border-[#e5e7eb]">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full"
            style={{ height: chartH }}
          >
            {series.map((s) => (
              <polyline
                key={s.label}
                fill="none"
                stroke={s.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                points={pathFor(s.values)}
              />
            ))}
          </svg>
          <div className="mt-2 flex justify-between text-[10px] text-[#9ca3af]">
            {labels.map((l, i) =>
              i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1 ? (
                <span key={l}>{l}</span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PersonalMockDonut({
  segments,
  centerLabel,
  centerValue,
  size = 140,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 40;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
          {segments.map((seg) => {
            const dash = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        {centerValue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[18px] font-bold text-[#111827]">{centerValue}</p>
            {centerLabel ? (
              <p className="text-[10px] text-[#6b7280]">{centerLabel}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="space-y-2 text-[12px]">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="text-[#374151]">{seg.label}</span>
            <span className="font-semibold text-[#111827]">
              {((seg.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonalMockBarChart({
  items,
  maxLabel,
  barClass = "bg-[#6366f1]",
}: {
  items: Array<{ label: string; value: number }>;
  maxLabel?: string;
  barClass?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {maxLabel ? (
        <p className="text-[12px] font-semibold text-[#111827]">{maxLabel}</p>
      ) : null}
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-[12px]">
          <span className="w-28 shrink-0 text-[#6b7280]">{item.label}</span>
          <div className="flex-1 h-2 rounded-full bg-[#f3f4f6]">
            <div
              className={cn("h-2 rounded-full", barClass)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-semibold text-[#111827]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PersonalMockProgress({
  value,
  max,
  label,
  sub,
  className,
}: {
  value: number;
  max: number;
  label?: string;
  sub?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={className}>
      {label ? (
        <div className="flex justify-between text-[12px]">
          <span className="text-[#6b7280]">{label}</span>
          <span className="font-semibold text-[#111827]">
            {value} / {max}
          </span>
        </div>
      ) : null}
      <div className="mt-2 h-2.5 w-full rounded-full bg-[#e5e7eb]">
        <div
          className="h-2.5 rounded-full bg-[#6366f1]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub ? <p className="mt-1 text-[11px] text-[#9ca3af]">{sub}</p> : null}
    </div>
  );
}
