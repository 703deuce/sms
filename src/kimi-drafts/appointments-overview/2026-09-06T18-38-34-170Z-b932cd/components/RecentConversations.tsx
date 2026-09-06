import { ArrowRight, MessageSquare } from "lucide-react";
import type { ConversationItem } from "../mock-data";

const avatarTint: Record<string, string> = {
  purple: "ref-tint-purple", green: "ref-tint-green", blue: "ref-tint-blue",
  red: "ref-tint-red", amber: "ref-tint-amber", indigo: "ref-tint-purple",
};

type Props = {
  conversations: ConversationItem[];
  onOpenConversation: (id: string) => void;
  onViewAll: () => void;
};

export default function RecentConversations({ conversations, onOpenConversation, onViewAll }: Props) {
  return (
    <section className="ref-card">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Recent conversations</h2>
        <button className="ref-card-link flex items-center gap-1" onClick={onViewAll}>
          View all <ArrowRight size={13} />
        </button>
      </div>
      {conversations.length === 0 ? (
        <div className="ref-empty">
          <span className="ref-tint-green flex h-11 w-11 items-center justify-center rounded-xl">
            <MessageSquare size={18} />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-gray-900">No conversations yet</h3>
          <p className="mt-1 max-w-[240px] text-[12.5px] text-gray-500">
            Customer replies and appointment messages will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-gray-100 pb-2">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenConversation(c.id)}
              className="ref-row-hover flex w-full items-center gap-3 px-[18px] py-3 text-left"
            >
              <span className={`${avatarTint[c.color]} flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold`}>
                {c.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-gray-900">{c.name}</div>
                <div className="truncate text-[12px] text-gray-500">{c.msg}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-gray-400">{c.time}</span>
                <span className={`ref-chip ref-chip-${c.tagColor}`}>{c.tag}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
