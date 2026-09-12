import { ArrowRight, BellRing, ShieldAlert, CheckSquare, ChevronRight } from "lucide-react";
import type { OverviewAttentionItem } from "@/features/appointments/kimi/overview/types";
import { RefDecoSection } from "../../shared/ref-deco-patterns";

const icons = { bell: BellRing, shield: ShieldAlert, "check-square": CheckSquare };

type Props = {
  items: OverviewAttentionItem[];
  onOpenItem: (href: string) => void;
  onReviewAll: () => void;
};

export default function NeedsAttention({ items, onOpenItem, onReviewAll }: Props) {
  return (
    <RefDecoSection
      accent="none"
      className="appt-overview-module appt-overview-module--flat"
      title="Needs attention"
      bodyClassName="flex flex-col"
    >
      {items.length === 0 ? (
        <p className="appt-pilot-text-body py-8 text-center text-[var(--text-secondary)]">Nothing needs attention right now.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((a) => {
            const Icon = icons[a.icon];
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenItem(a.href)}
                className="appt-pilot-attention-row flex items-center gap-3 rounded-lg border border-gray-100 px-3.5 py-3 text-left transition"
              >
                <div className={`icon-tile tile-${a.tint}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                  <Icon size={17} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="appt-pilot-text-list font-semibold text-[var(--text-primary)]">{a.title}</div>
                  <div className="appt-pilot-text-list truncate text-[var(--text-secondary)]">{a.sub}</div>
                </div>
                <ChevronRight size={16} className="text-gray-300" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onReviewAll}
        className="appt-pilot-muted-link mt-3 flex items-center gap-1.5"
      >
        Review all issues <ArrowRight size={14} aria-hidden />
      </button>
    </RefDecoSection>
  );
}
