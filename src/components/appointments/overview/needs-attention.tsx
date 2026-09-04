import { AlertOctagon, ArrowRight, CheckSquare, Shield } from "lucide-react";
import Link from "next/link";

export type AttentionRow = {
  id: string;
  kind: string;
  label: string;
  href: string;
};

function attentionMeta(kind: string) {
  if (kind === "reminder_failed") {
    return { icon: AlertOctagon, tone: "rose" as const, desc: "Reminders couldn't be delivered" };
  }
  if (kind.includes("suspicious") || kind.includes("protection")) {
    return { icon: Shield, tone: "amber" as const, desc: "Flagged by AI Booking Protection" };
  }
  if (kind.includes("setup") || kind.includes("onboarding")) {
    return { icon: CheckSquare, tone: "violet" as const, desc: "Finish remaining setup steps" };
  }
  return { icon: AlertOctagon, tone: "amber" as const, desc: "Needs your review" };
}

const toneBg = {
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-primary/10 text-primary",
};

export function OverviewNeedsAttention({ items }: { items: AttentionRow[] }) {
  return (
    <div className="appt-overview__card flex h-full flex-col">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold text-foreground">Needs attention</h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.slice(0, 4).map((item) => {
            const meta = attentionMeta(item.kind);
            const Icon = meta.icon;
            return (
              <li key={item.id}>
                <Link href={item.href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneBg[meta.tone]}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{meta.desc}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <Link href="/appointments/setup" className="appt-overview__link">Review all issues →</Link>
        </div>
      ) : null}
    </div>
  );
}
