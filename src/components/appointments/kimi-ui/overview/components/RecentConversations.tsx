import { ArrowRight } from 'lucide-react';
import { conversations } from '../mock-data';

export default function RecentConversations() {
  return (
    <div className="ref-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-bold text-gray-900">Recent conversations</h3>
        <button className="text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
      </div>
      <div className="divide-y divide-gray-50">
        {conversations.map((c) => (
          <div key={c.name} className="flex items-center gap-3 py-3">
            <div className={`avatar av-${c.color}`}>{c.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gray-900">{c.name}</div>
              <div className="text-[12px] text-gray-500 truncate">{c.msg}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`ref-pill pill-${c.tagColor}`}>{c.tag}</span>
              <span className="text-[11px] text-gray-400">{c.time}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 mt-2">
        Go to conversations <ArrowRight size={14} />
      </button>
    </div>
  );
}
