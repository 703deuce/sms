import { ArrowRight, Bell, CheckSquare, ShieldAlert } from "lucide-react";
import type { AttentionItem } from "../mock-data";

const icons = { bell: Bell, shield: ShieldAlert, "check-square": CheckSquare };

type Props = {
  items: AttentionItem[];
  onOpenItem: (href: string) => void;
  onReviewAll: () => void;
};

export default function NeedsAttention({ items, onOpenItem, onReviewAll }: Props) {
  return (
    <section className="ref-card">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Needs attention</h2>
        <button className="ref-card-link flex items-center gap-1" onClick={onReviewAll}>
          Review all <ArrowRight size={13} />
        </button>
      </div>
      <div className="mt-2 divide-y divide-gray-100 pb-2">
        {items.map((it) => {
          const Icon = icons[it.icon];
          return (
            <button
              key={it.id}
              onClick={() => onOpenItem(it.href)}
              className="ref-row-hover flex w-full items-center gap-3 px-[18px] py-3 text-left"
            >
              <span className={`ref-tint-${it.tint} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg`}>
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-gray-900">{it.title}</div>
                <div className="truncate text-[12px] text-gray-500">{it.sub}</div>
              </div>
              <ArrowRight size={14} className="shrink-0 text-gray-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
