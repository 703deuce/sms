import { Plus, Link2, Send, Clock, ListChecks, ChevronRight, Check } from 'lucide-react';

type Props = {
  copied?: boolean;
  onNewAppointment: () => void;
  onCopyBookingLink: () => void;
  onSendTestReminder: () => void;
  onConfigureAvailability: () => void;
  onManageTypes: () => void;
};

export default function QuickActions({
  copied,
  onNewAppointment,
  onCopyBookingLink,
  onSendTestReminder,
  onConfigureAvailability,
  onManageTypes,
}: Props) {
  const actions = [
    { icon: Plus, label: 'New appointment', onClick: onNewAppointment },
    { icon: copied ? Check : Link2, label: copied ? 'Link copied!' : 'Copy booking link', onClick: onCopyBookingLink },
    { icon: Send, label: 'Send test reminder', onClick: onSendTestReminder },
    { icon: Clock, label: 'Configure availability', onClick: onConfigureAvailability },
  ];

  return (
    <div className="ref-card p-5 flex flex-col">
      <h3 className="text-[15px] font-bold text-gray-900 mb-3">Quick actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} className="qa-btn">
            <a.icon size={18} strokeWidth={2} />
            {a.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onManageTypes}
        className="mt-3 flex items-center gap-2.5 rounded-xl border border-gray-100 px-4 py-3 text-[13px] font-semibold text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition"
      >
        <ListChecks size={17} />
        <span className="flex-1 text-left">Manage appointment types</span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
    </div>
  );
}
