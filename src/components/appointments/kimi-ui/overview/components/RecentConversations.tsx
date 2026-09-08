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
          className="appt-pilot-muted-link"
        >
          View all
        </button>
      }
      bodyClassName="flex flex-col"
    >
      {conversations.length === 0 ? (
        <p className="appt-pilot-text-body py-8 text-center text-[var(--text-secondary)]">No recent conversations.</p>
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
                <div className="appt-pilot-text-list font-semibold text-[var(--text-primary)]">{c.name}</div>
                <div className="appt-pilot-text-list truncate text-[var(--text-secondary)]">{c.msg}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`ref-pill pill-${c.tagColor}`}>{c.tag}</span>
                <span className="appt-pilot-text-helper">{c.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="appt-pilot-muted-link mt-2 flex items-center gap-1.5"
      >
        Go to conversations <ArrowRight size={14} aria-hidden />
      </button>
    </RefDecoSection>
  );
}
