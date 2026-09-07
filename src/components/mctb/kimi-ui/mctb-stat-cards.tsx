import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import "../kimi-ui/reference.css";

export type MctbStatItem = {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon: LucideIcon;
  tint: "purple" | "green" | "blue" | "amber" | "red";
  highlight?: boolean;
};

export function MctbStatCards({ stats }: { stats: MctbStatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        const inner = (
          <div
            className={`ref-card flex items-center gap-4 px-5 py-5 transition hover:border-indigo-200 ${
              s.highlight ? "ring-1 ring-indigo-200" : ""
            }`}
          >
            <div className={`icon-tile tile-${s.tint}`}>
              <Icon size={20} strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-gray-500">{s.label}</div>
              <div className="text-[22px] font-bold leading-tight text-gray-900 tabular-nums">
                {s.value}
              </div>
              {s.sub ? <div className="mt-0.5 text-[12px] text-gray-400">{s.sub}</div> : null}
            </div>
          </div>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {inner}
          </Link>
        ) : (
          <div key={s.label}>{inner}</div>
        );
      })}
    </div>
  );
}
