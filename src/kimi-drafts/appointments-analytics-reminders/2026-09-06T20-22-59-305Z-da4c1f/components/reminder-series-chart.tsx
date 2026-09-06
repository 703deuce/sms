"use client";

import { useMemo } from "react";

function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ReminderSeriesChart({
  series,
}: {
  series: Array<{ date: string; count: number }>;
}) {
  const { path, area, max, labels } = useMemo(() => {
    const w = 640;
    const h = 200;
    const pad = 8;
    const maxV = Math.max(1, ...series.map((s) => s.count));
    const stepX = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
    const pts = series.map((s, i) => ({
      x: pad + i * stepX,
      y: h - pad - (s.count / maxV) * (h - pad * 2),
    }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const fill = `${line} L${(pad + (series.length - 1) * stepX).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
    const labelIdx = [0, Math.floor(series.length / 2), series.length - 1];
    return {
      path: line,
      area: fill,
      max: maxV,
      labels: labelIdx.map((i) => formatSeriesDate(series[i]?.date ?? "")),
    };
  }, [series]);

  return (
    <div>
      <svg
        className="tv-chart"
        viewBox="0 0 640 200"
        role="img"
        aria-label={`Reminders sent per day, peak ${max}`}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="8"
            x2="632"
            y1={200 * f}
            y2={200 * f}
            stroke="#eef0f3"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="rgba(79,70,229,0.08)" />
        <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="tv-chart-x">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
        <span>{labels[2]}</span>
      </div>
    </div>
  );
}
