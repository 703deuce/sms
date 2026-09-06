import { ArrowRight, Bell, CheckCircle2, CheckSquare, ShieldAlert } from "lucide-react";
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
        {items.length > 0 && (
          <button className="ref-card-link flex items-center gap-1" onClick={onReviewAll}>
            Review all <ArrowRight size={13} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="ref-empty">
          <span className="ref-tint-green flex h-11 w-11 items-center justify-center rounded-xl">
            <CheckCircle2 size={18} />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-gray-900">All caught up</h3>
          <p className="mt-1 max-w-[240px] text-[12.5px] text-gray-500">
            Nothing needs your attention right now. Confirmation requests, failed reminders, and unread replies will appear here.
          </p>
        </div>
      ) : (
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
      )}
    </section>
  );
}
