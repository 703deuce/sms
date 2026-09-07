import { ArrowRight, BellRing, ChevronRight, MessageSquare, PhoneMissed, Voicemail } from "lucide-react";
import Link from "next/link";
import { MctbIconRing } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import "../kimi-ui/reference.css";

export type MctbAttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  kind: "missed_call" | "reply" | "voicemail" | "other";
};

const ICONS = {
  missed_call: PhoneMissed,
  reply: MessageSquare,
  voicemail: Voicemail,
  other: BellRing,
};

const TINTS = {
  missed_call: "amber",
  reply: "purple",
  voicemail: "blue",
  other: "red",
} as const;

export function MctbNeedsAttention({
  items,
  viewAllHref,
}: {
  items: MctbAttentionItem[];
  viewAllHref?: string;
}) {
  return (
    <div className="ref-deco-section ref-deco-section--tint-amber h-full flex flex-col">
      <div className="ref-deco-section-head">
        <div className="flex items-center gap-2.5">
          <span className="ref-deco-section-accent ref-deco-section-accent--amber" aria-hidden />
          <h3 className="text-[15px] font-bold text-gray-900">Needs attention</h3>
        </div>
      </div>
      <div className="ref-deco-section-body flex flex-1 flex-col">
        {items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-gray-500">Nothing needs attention right now.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              const tint = TINTS[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-amber-100/80 bg-white/80 px-3.5 py-3 transition hover:border-amber-200 hover:bg-white hover:shadow-[0_6px_16px_rgba(245,158,11,0.08)]"
                  >
                    <MctbIconRing icon={Icon} tint={tint} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-gray-900">{item.title}</div>
                      {item.subtitle ? (
                        <div className="truncate text-[12px] text-gray-500">{item.subtitle}</div>
                      ) : null}
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-amber-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Review all issues <ArrowRight size={14} aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
