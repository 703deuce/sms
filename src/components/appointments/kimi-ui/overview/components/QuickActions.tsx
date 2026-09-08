import { Plus, Link2, Send, Clock, ListChecks, ChevronRight, Check } from "lucide-react";
import { RefDecoSection } from "../../shared/ref-deco-patterns";

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
    { icon: Plus, label: "New appointment", onClick: onNewAppointment },
    { icon: copied ? Check : Link2, label: copied ? "Link copied!" : "Copy booking link", onClick: onCopyBookingLink },
    { icon: Send, label: "Send test reminder", onClick: onSendTestReminder },
    { icon: Clock, label: "Configure availability", onClick: onConfigureAvailability },
  ];

  return (
    <RefDecoSection title="Quick actions" bodyClassName="flex flex-col">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} className="qa-btn">
            <a.icon size={18} strokeWidth={2} aria-hidden />
            {a.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onManageTypes}
        className="appt-pilot-secondary-btn mt-3 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition"
      >
        <ListChecks size={17} aria-hidden />
        <span className="flex-1 text-left">Manage appointment types</span>
        <ChevronRight size={16} className="text-gray-300" aria-hidden />
      </button>
    </RefDecoSection>
  );
}
