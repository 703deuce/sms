import { CalendarCheck2, CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { stats } from '../mock-data';

const icons: Record<string, any> = { calendar: CalendarCheck2, check: CheckCircle2, send: Send, shield: ShieldCheck };

export default function StatCards() {
  return (
    <div className="grid grid-cols-4 gap-5">
      {stats.map((s) => {
        const Icon = icons[s.icon];
        return (
          <div key={s.label} className="ref-card flex items-center gap-4 px-5 py-5">
            <div className={`icon-tile tile-${s.tint}`}><Icon size={20} strokeWidth={2} /></div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-gray-500">{s.label}</div>
              <div className="text-[22px] font-bold text-gray-900 leading-tight">{s.value}</div>
              <div className={`text-[12px] mt-0.5 ${s.icon === 'check' ? 'text-green-600 font-medium' : s.icon === 'shield' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{s.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
