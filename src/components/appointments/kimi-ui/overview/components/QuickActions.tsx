import { Plus, Link2, Send, Clock, ListChecks, ChevronRight } from 'lucide-react';

const actions = [
  { icon: Plus, label: 'New appointment' },
  { icon: Link2, label: 'Copy booking link' },
  { icon: Send, label: 'Send test reminder' },
  { icon: Clock, label: 'Configure availability' },
];

export default function QuickActions() {
  return (
    <div className="ref-card p-5 flex flex-col">
      <h3 className="text-[15px] font-bold text-gray-900 mb-3">Quick actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button key={a.label} className="qa-btn">
            <a.icon size={18} strokeWidth={2} />
            {a.label}
          </button>
        ))}
      </div>
      <button className="mt-3 flex items-center gap-2.5 rounded-xl border border-gray-100 px-4 py-3 text-[13px] font-semibold text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition">
        <ListChecks size={17} />
        <span className="flex-1 text-left">Manage appointment types</span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
    </div>
  );
}
