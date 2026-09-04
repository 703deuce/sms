import { ArrowRight, BellRing, ShieldAlert, CheckSquare, ChevronRight } from 'lucide-react';
import { attention } from '../mock-data';

const icons: Record<string, any> = { bell: BellRing, shield: ShieldAlert, 'check-square': CheckSquare };

export default function NeedsAttention() {
  return (
    <div className="ref-card p-5 flex flex-col">
      <h3 className="text-[15px] font-bold text-gray-900 mb-3">Needs attention</h3>
      <div className="flex flex-col gap-2.5">
        {attention.map((a) => {
          const Icon = icons[a.icon];
          return (
            <button key={a.title} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3.5 text-left hover:border-indigo-200 hover:shadow-sm transition">
              <div className={`icon-tile tile-${a.tint}`} style={{ width: 36, height: 36, borderRadius: 10 }}><Icon size={17} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-gray-900">{a.title}</div>
                <div className="text-[12px] text-gray-500 truncate">{a.sub}</div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          );
        })}
      </div>
      <button className="flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 mt-3">
        Review all issues <ArrowRight size={14} />
      </button>
    </div>
  );
}
