import { ArrowRight, CalendarCheck, CheckCircle2, Send, ShieldCheck } from "lucide-react";

export type OverviewStatCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  subTone?: "green" | "muted";
  icon: "calendar" | "check" | "send" | "shield";
  tone: "violet" | "green" | "blue" | "amber";
};

const iconMap = {
  calendar: CalendarCheck,
  check: CheckCircle2,
  send: Send,
  shield: ShieldCheck,
} as const;

const toneMap = {
  violet: { bg: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" },
  green: { bg: "#e8faf0", color: "#16a34a" },
  blue: { bg: "#e8f1fe", color: "#3b82f6" },
  amber: { bg: "#fef6e7", color: "#d97706" },
};

export function OverviewStatCards({ cards }: { cards: OverviewStatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = iconMap[card.icon];
        const tone = toneMap[card.tone];
        return (
          <div key={card.id} className="appt-overview__card flex items-center gap-3.5 px-5 py-5">
            <div className="appt-overview__icon-tile" style={{ background: tone.bg, color: tone.color }}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] text-muted-foreground">{card.label}</p>
              <p className="text-[24px] font-bold leading-tight text-foreground">{card.value}</p>
              <p
                className="mt-0.5 text-[12px]"
                style={{ color: card.subTone === "green" ? "#16a34a" : undefined }}
              >
                {card.id === "upcoming" && card.sub.startsWith("Next:") ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {card.sub} <ArrowRight size={12} />
                  </span>
                ) : (
                  <span className={card.subTone === "green" ? "" : "text-muted-foreground"}>{card.sub}</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
