import { Button } from "@/components/ui/button";
import { CalendarPlus, ClipboardCopy, MessageSquare, Settings2 } from "lucide-react";
import Link from "next/link";

export function OverviewQuickActions({
  bookingUrl,
  onCopyBookingLink,
  copied,
}: {
  bookingUrl: string | null;
  onCopyBookingLink: () => void;
  copied: boolean;
}) {
  const actions = [
    { label: "New appointment", href: "/appointments/new", icon: CalendarPlus },
    { label: copied ? "Copied!" : "Copy booking link", onClick: onCopyBookingLink, icon: ClipboardCopy, disabled: !bookingUrl },
    { label: "Send test reminder", href: "/appointments/reminders", icon: MessageSquare },
    { label: "Configure availability", href: "/appointments/availability", icon: Settings2 },
  ];

  return (
    <div className="appt-overview__card flex h-full flex-col p-5">
      <h2 className="text-[15px] font-semibold text-foreground">Quick actions</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          if (action.href) {
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                <Icon size={15} className="text-primary" />
                {action.label}
              </Link>
            );
          }
          return (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-3 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon size={15} className="text-primary" />
              {action.label}
            </button>
          );
        })}
      </div>
      <Link href="/appointments/types" className="mt-3 block">
        <Button variant="outline" className="w-full">Manage appointment types</Button>
      </Link>
    </div>
  );
}
