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
    <RefDecoSection title="Needs attention" tint="amber" accent="amber" bodyClassName="flex flex-col">
      {items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-gray-500">Nothing needs attention right now.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((a) => {
            const Icon = icons[a.icon];
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenItem(a.href)}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3.5 text-left transition hover:border-indigo-200 hover:shadow-sm"
              >
                <div className={`icon-tile tile-${a.tint}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                  <Icon size={17} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-gray-900">{a.title}</div>
                  <div className="truncate text-[12px] text-gray-500">{a.sub}</div>
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
        className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        Review all issues <ArrowRight size={14} aria-hidden />
      </button>
    </RefDecoSection>
  );
}
