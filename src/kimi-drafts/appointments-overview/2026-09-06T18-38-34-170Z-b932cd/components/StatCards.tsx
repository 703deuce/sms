import { Calendar, CheckCircle2, Send, ShieldCheck } from "lucide-react";
import type { StatItem } from "../mock-data";

const icons = { calendar: Calendar, check: CheckCircle2, send: Send, shield: ShieldCheck };

export default function StatCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = icons[s.icon];
        return (
          <div key={s.label} className="ref-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-gray-500">{s.label}</span>
              <span className={`ref-tint-${s.tint} flex h-8 w-8 items-center justify-center rounded-lg`}>
                <Icon size={15} />
              </span>
            </div>
            <div className="mt-1 text-[24px] font-bold tracking-tight text-gray-900">{s.value}</div>
            <div className="mt-0.5 text-[12px] text-gray-500">{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
