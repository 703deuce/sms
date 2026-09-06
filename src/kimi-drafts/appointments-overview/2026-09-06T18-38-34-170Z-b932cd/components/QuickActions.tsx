import { CalendarPlus, Check, Clock, Link2, Send, Tag } from "lucide-react";

type Props = {
  copied?: boolean;
  onNewAppointment: () => void;
  onCopyBookingLink: () => void;
  onSendTestReminder: () => void;
  onConfigureAvailability: () => void;
  onManageTypes: () => void;
};

export default function QuickActions({
  copied, onNewAppointment, onCopyBookingLink, onSendTestReminder, onConfigureAvailability, onManageTypes,
}: Props) {
  const items = [
    { label: "New appointment", sub: "Book a customer manually", icon: CalendarPlus, onClick: onNewAppointment, tint: "ref-tint-purple" },
    { label: copied ? "Link copied!" : "Copy booking link", sub: "Share your public booking page", icon: copied ? Check : Link2, onClick: onCopyBookingLink, tint: "ref-tint-blue" },
    { label: "Send test reminder", sub: "Preview an SMS reminder", icon: Send, onClick: onSendTestReminder, tint: "ref-tint-green" },
    { label: "Configure availability", sub: "Hours, buffers & overrides", icon: Clock, onClick: onConfigureAvailability, tint: "ref-tint-amber" },
    { label: "Manage booking types", sub: "Services customers can book", icon: Tag, onClick: onManageTypes, tint: "ref-tint-purple" },
  ];

  return (
    <section className="ref-card">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Quick actions</h2>
      </div>
      <div className="mt-2 space-y-0.5 px-2 pb-3">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={it.onClick}
            className="ref-row-hover flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
          >
            <span className={`${it.tint} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg`}>
              <it.icon size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-gray-900">{it.label}</div>
              <div className="text-[11.5px] text-gray-500">{it.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
