import { ArrowRight, BellRing, ChevronRight, MessageSquare, PhoneMissed, Voicemail } from "lucide-react";
import Link from "next/link";
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
    <div className="ref-card flex flex-col p-5">
      <h3 className="mb-3 text-[15px] font-bold text-gray-900">Needs attention</h3>
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
                  className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3.5 transition hover:border-indigo-200 hover:shadow-sm"
                >
                  <div className={`icon-tile tile-${tint}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                    <Icon size={17} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-gray-900">{item.title}</div>
                    {item.subtitle ? (
                      <div className="truncate text-[12px] text-gray-500">{item.subtitle}</div>
                    ) : null}
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" aria-hidden />
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
  );
}
