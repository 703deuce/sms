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
      stats={stats.map((s) => ({
        label: s.label,
        value: s.value,
        sub: s.sub,
        icon: icons[s.icon],
        tint: s.tint,
        subClassName:
          s.icon === "check" || s.icon === "shield"
            ? "text-green-600 font-medium"
            : "text-gray-400",
      }))}
    />
  );
}
