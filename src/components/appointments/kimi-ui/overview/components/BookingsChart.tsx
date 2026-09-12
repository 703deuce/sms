import { ChevronDown } from "lucide-react";
import type { OverviewChartModel } from "@/features/appointments/kimi/overview/types";
import { RefDecoSection } from "../../shared/ref-deco-patterns";

export default function BookingsChart({ chart }: { chart: OverviewChartModel }) {
  const W = 560,
    H = 170,
    pad = 10;
  const max = Math.max(...chart.points, 1);
  const xs = chart.points.map((_, i) => pad + (i * (W - pad * 2)) / Math.max(chart.points.length - 1, 1));
  const ys = chart.points.map((v) => H - 14 - (v / max) * (H - 40));
  const solidEnd = Math.max(chart.points.length - 2, 0);
  const solidPts = xs.slice(0, solidEnd + 1).map((x, i) => `${x},${ys[i]}`).join(" ");
  const dashedPts =
    chart.points.length > 1
      ? `${xs[solidEnd]},${ys[solidEnd]} ${xs[chart.points.length - 1]},${ys[chart.points.length - 1]}`
      : "";
  const areaPts = `${pad},${H - 14} ${solidPts} ${xs[solidEnd] ?? pad},${H - 14}`;

  return (
    <RefDecoSection
      accent="none"
      className="appt-overview-module appt-overview-chart-module"
      title="Bookings this week"
      action={
        <button
          type="button"
          className="appt-pilot-filter-btn flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium"
        >
          This week <ChevronDown size={14} aria-hidden />
        </button>
      }
      bodyClassName="ref-deco-chart !p-4 flex flex-col"
    >
      <div className="appt-pilot-chart-total">{chart.total}</div>
      <div className="appt-pilot-chart-label mt-1">Total appointments</div>
      <div className="appt-pilot-chart-delta text-[var(--text-secondary)]">{chart.deltaLabel}</div>
      <div className="appt-overview-chart-wrap mt-3 -mx-1">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="appt-overview-chart-svg w-full" role="img" aria-label="Bookings trend chart">
          <defs>
            <linearGradient id="apptPilotAreaG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#394049" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#394049" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[max, Math.round(max * 0.66), Math.round(max * 0.33), 0].map((v) => {
            const y = H - 14 - (v / max) * (H - 40);
            return (
              <g key={v}>
                <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="#E4E7EA" />
                <text x={pad - 2} y={y + 3} fontSize="9" fill="#7B828C" textAnchor="end">{v}</text>
              </g>
            );
          })}
          <polygon points={areaPts} fill="url(#apptPilotAreaG)" />
          {solidPts ? (
            <polyline
              points={solidPts}
              fill="none"
              stroke="#394049"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {dashedPts ? (
            <polyline
              points={dashedPts}
              fill="none"
              stroke="#9BA2AB"
              strokeOpacity="1"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          ) : null}
          {xs[solidEnd] !== undefined ? <circle cx={xs[solidEnd]} cy={ys[solidEnd]} r="4.5" className="chart-dot" /> : null}
          {chart.days.map((d, i) => (
            <text
              key={`${d}-${i}`}
              x={xs[i]}
              y={H + 12}
              fontSize="10"
              fill={i === chart.days.length - 2 ? "#394049" : "#7B828C"}
              textAnchor="middle"
              fontWeight={i === chart.days.length - 2 ? 700 : 400}
            >
              {d}
            </text>
          ))}
        </svg>
      </div>
      <div className="appt-pilot-chart-stat mt-auto grid grid-cols-2 gap-3 px-3 py-2.5">
        <div>
          <div className="appt-pilot-text-helper">Peak day</div>
          <div className="appt-pilot-text-list font-semibold text-[var(--text-primary)]">{chart.peakLabel}</div>
        </div>
        <div className="text-right">
          <div className="appt-pilot-text-helper">vs last week</div>
          <div
            className={
              chart.vsLastWeek.includes("↑")
                ? "appt-pilot-semantic-positive appt-pilot-text-list font-semibold"
                : "appt-pilot-text-list font-semibold text-[var(--text-secondary)]"
            }
          >
            {chart.vsLastWeek}
          </div>
        </div>
      </div>
    </RefDecoSection>
  );
}
