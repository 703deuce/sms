import { ArrowRight } from "lucide-react";
import type { OverviewConversationItem } from "@/features/appointments/kimi/overview/types";
import { RefDecoSection } from "../../shared/ref-deco-patterns";

type Props = {
  conversations: OverviewConversationItem[];
  onOpenConversation: (id: string) => void;
  onViewAll?: () => void;
};

export default function RecentConversations({ conversations, onOpenConversation, onViewAll }: Props) {
  return (
    <RefDecoSection
      title="Recent conversations"
      action={
        <button
          type="button"
          onClick={onViewAll}
          className="appt-pilot-muted-link text-[12.5px]"
        >
          View all
        </button>
      }
      bodyClassName="flex flex-col"
    >
      {conversations.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-gray-500">No recent conversations.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {conversations.map((c) => (
            <div
              key={c.id}
              className="flex cursor-pointer items-center gap-3 py-3"
              onClick={() => onOpenConversation(c.id)}
            >
              <div className={`avatar av-${c.color}`}>{c.initials}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-gray-900">{c.name}</div>
                <div className="truncate text-[12px] text-gray-500">{c.msg}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`ref-pill pill-${c.tagColor}`}>{c.tag}</span>
                <span className="text-[11px] text-gray-400">{c.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="appt-pilot-muted-link mt-2 flex items-center gap-1.5 text-[13px]"
      >
        Go to conversations <ArrowRight size={14} aria-hidden />
      </button>
    </RefDecoSection>
  );
}
