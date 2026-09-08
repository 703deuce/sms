import { CalendarCheck2, CheckCircle2, Send, ShieldCheck } from "lucide-react";
import type { OverviewStatItem } from "@/features/appointments/kimi/overview/types";
import { RefDecoStatCards } from "../../shared/ref-deco-patterns";

const icons: Record<string, typeof CalendarCheck2> = {
  calendar: CalendarCheck2,
  check: CheckCircle2,
  send: Send,
  shield: ShieldCheck,
};

export default function StatCards({ stats }: { stats: OverviewStatItem[] }) {
  return (
    <RefDecoStatCards
      stats={stats.map((s, index) => ({
        label: s.label,
        value: s.value,
        sub: s.sub,
        icon: icons[s.icon],
        tint: s.tint,
        highlight: index === 0,
        subClassName:
          s.icon === "check" || (s.icon === "shield" && /excellent|good/i.test(s.sub))
            ? "text-green-600 font-medium"
            : s.icon === "shield" && /failed/i.test(s.sub)
              ? "text-amber-600 font-medium"
              : "text-gray-400",
      }))}
    />
  );
}
