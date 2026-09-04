import { ChevronDown } from 'lucide-react';
import { chartPoints, chartDays } from '../mock-data';

export default function BookingsChart() {
  const W = 560, H = 170, pad = 10;
  const max = 30;
  const xs = chartPoints.map((_, i) => pad + (i * (W - pad * 2)) / 6);
  const ys = chartPoints.map((v) => H - 14 - (v / max) * (H - 40));
  const solidPts = xs.slice(0, 6).map((x, i) => `${x},${ys[i]}`).join(' ');
  const dashedPts = `${xs[5]},${ys[5]} ${xs[6]},${ys[6]}`;
  const areaPts = `${pad},${H - 14} ${solidPts} ${xs[5]},${H - 14}`;

  return (
    <div className="ref-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold text-gray-900">Bookings this week</h3>
        <button className="flex items-center gap-1 text-[12.5px] font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
          This week <ChevronDown size={14} />
        </button>
      </div>
      <div className="text-[26px] font-bold text-gray-900 leading-none mt-1">28</div>
      <div className="text-[12px] text-gray-500 mt-1">Total appointments</div>
      <div className="text-[12px] text-green-600 font-medium">↑ 27% vs last week</div>
      <div className="mt-3 -mx-1">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full">
          <defs>
            <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[30, 20, 10, 0].map((v) => {
            const y = H - 14 - (v / max) * (H - 40);
            return (
              <g key={v}>
                <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="#f1f3f7" />
                <text x={pad - 2} y={y + 3} fontSize="9" fill="#b6bcc9" textAnchor="end">{v}</text>
              </g>
            );
          })}
          <polygon points={areaPts} fill="url(#areaG)" />
          <polyline points={solidPts} fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={dashedPts} fill="none" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx={xs[5]} cy={ys[5]} r="4.5" className="chart-dot" />
          {chartDays.map((d, i) => (
            <text key={d} x={xs[i]} y={H + 12} fontSize="10" fill={i === 5 ? '#4f46e5' : '#9aa1af'} textAnchor="middle" fontWeight={i === 5 ? 700 : 400}>{d}</text>
          ))}
        </svg>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <div className="text-[11px] text-gray-400">Peak day</div>
          <div className="text-[13px] font-semibold text-gray-900">Thu 8/29 <span className="font-normal text-gray-500">· 8 appointments</span></div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-400">vs last week</div>
          <div className="text-[13px] font-semibold text-green-600">↑ 27%</div>
        </div>
      </div>
    </div>
  );
}
