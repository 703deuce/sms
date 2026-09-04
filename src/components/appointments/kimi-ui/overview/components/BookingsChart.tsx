import { ChevronDown } from 'lucide-react';
import type { OverviewChartModel } from '@/features/appointments/kimi/overview/types';

export default function BookingsChart({ chart }: { chart: OverviewChartModel }) {
  const W = 560, H = 170, pad = 10;
  const max = Math.max(...chart.points, 1);
  const xs = chart.points.map((_, i) => pad + (i * (W - pad * 2)) / Math.max(chart.points.length - 1, 1));
  const ys = chart.points.map((v) => H - 14 - (v / max) * (H - 40));
  const solidEnd = Math.max(chart.points.length - 2, 0);
  const solidPts = xs.slice(0, solidEnd + 1).map((x, i) => `${x},${ys[i]}`).join(' ');
  const dashedPts = chart.points.length > 1
    ? `${xs[solidEnd]},${ys[solidEnd]} ${xs[chart.points.length - 1]},${ys[chart.points.length - 1]}`
    : "";
  const areaPts = `${pad},${H - 14} ${solidPts} ${xs[solidEnd] ?? pad},${H - 14}`;

  return (
    <div className="ref-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold text-gray-900">Bookings this week</h3>
        <button type="button" className="flex items-center gap-1 text-[12.5px] font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
          This week <ChevronDown size={14} />
        </button>
      </div>
      <div className="text-[26px] font-bold text-gray-900 leading-none mt-1">{chart.total}</div>
      <div className="text-[12px] text-gray-500 mt-1">Total appointments</div>
      <div className="text-[12px] text-green-600 font-medium">{chart.deltaLabel}</div>
      <div className="mt-3 -mx-1">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full">
          <defs>
            <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[max, Math.round(max * 0.66), Math.round(max * 0.33), 0].map((v) => {
            const y = H - 14 - (v / max) * (H - 40);
            return (
              <g key={v}>
                <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="#f1f3f7" />
                <text x={pad - 2} y={y + 3} fontSize="9" fill="#b6bcc9" textAnchor="end">{v}</text>
              </g>
            );
          })}
          <polygon points={areaPts} fill="url(#areaG)" />
          {solidPts ? <polyline points={solidPts} fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {dashedPts ? <polyline points={dashedPts} fill="none" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="4 4" /> : null}
          {xs[solidEnd] !== undefined ? <circle cx={xs[solidEnd]} cy={ys[solidEnd]} r="4.5" className="chart-dot" /> : null}
          {chart.days.map((d, i) => (
            <text key={`${d}-${i}`} x={xs[i]} y={H + 12} fontSize="10" fill={i === chart.days.length - 2 ? '#4f46e5' : '#9aa1af'} textAnchor="middle" fontWeight={i === chart.days.length - 2 ? 700 : 400}>{d}</text>
          ))}
        </svg>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <div className="text-[11px] text-gray-400">Peak day</div>
          <div className="text-[13px] font-semibold text-gray-900">{chart.peakLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-400">vs last week</div>
          <div className="text-[13px] font-semibold text-green-600">{chart.vsLastWeek}</div>
        </div>
      </div>
    </div>
  );
}
