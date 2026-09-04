import { cn } from "@/lib/utils";

export type BookingsChartData = {
  total: number;
  deltaLabel: string;
  days: string[];
  values: number[];
  peakLabel: string;
  vsLastWeek: string;
};

export function OverviewBookingsChart({ data }: { data: BookingsChartData }) {
  const max = Math.max(...data.values, 1);
  const width = 560;
  const height = 160;
  const padding = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const points = data.values.map((v, i) => {
    const x = padding.left + (i / Math.max(data.values.length - 1, 1)) * innerW;
    const y = padding.top + innerH - (v / max) * innerH;
    return { x, y, v };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${padding.top + innerH} L ${points[0]?.x ?? 0} ${padding.top + innerH} Z`;
  const peakIdx = data.values.indexOf(Math.max(...data.values));

  return (
    <div className="appt-overview__card flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Bookings this week</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">This week</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-bold tabular-nums text-foreground">{data.total}</p>
          <p className="text-[12px] text-emerald-600">{data.deltaLabel}</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full" aria-hidden>
          <defs>
            <linearGradient id="ov-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#ov-chart-fill)" />
          <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === peakIdx ? 5 : 0}
              fill="hsl(var(--primary))"
              stroke="white"
              strokeWidth="2"
            />
          ))}
          {data.days.map((day, i) => {
            const x = padding.left + (i / Math.max(data.days.length - 1, 1)) * innerW;
            return (
              <text
                key={day}
                x={x}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {day}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
        <span>Peak day: {data.peakLabel}</span>
        <span className={cn(data.vsLastWeek.startsWith("↑") ? "text-emerald-600" : "")}>
          vs last week: {data.vsLastWeek}
        </span>
      </div>
    </div>
  );
}
