"use client";

import { CalendarClock, Layers, Ticket, Users, Wallet } from "lucide-react";
import type { MembershipFormState } from "@/lib/appointments/memberships/membership-form";
import { accessSummary, formatBillingInterval, formatMoney } from "@/lib/appointments/memberships/membership-form";

type Props = {
  form: MembershipFormState;
  memberStats: { active: number; pastDue: number; cancelling: number };
  renewalsThisMonth: number;
};

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <span className="ws-meta-item" title={`${label}: ${value}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <strong>{value}</strong>
    </span>
  );
}

export function MembershipSummaryStrip({ form, memberStats, renewalsThisMonth }: Props) {
  const access = accessSummary(form);
  const price = `${formatMoney(form.priceCents)} / ${formatBillingInterval(form.billingInterval).toLowerCase()}`;

  return (
    <div className="ws-meta-strip" aria-label="Membership summary">
      <MetaItem icon={Wallet} label="Price" value={price} />
      <MetaItem icon={Users} label="Active members" value={String(memberStats.active)} />
      <MetaItem icon={Users} label="Past due" value={String(memberStats.pastDue)} />
      <MetaItem icon={Layers} label="Access" value={access.label} />
      {renewalsThisMonth > 0 ? (
        <MetaItem icon={CalendarClock} label="Renewals this month" value={String(renewalsThisMonth)} />
      ) : null}
      <MetaItem
        icon={Ticket}
        label="Status"
        value={form.active ? "Active" : "Inactive"}
      />
    </div>
  );
}
