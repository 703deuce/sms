"use client";

import { CalendarClock, Layers, Ticket, Users, Wallet } from "lucide-react";
import type { PackageFormState } from "@/lib/appointments/packages/package-form";
import { formatMoney } from "@/lib/appointments/packages/package-form";

type Props = {
  form: PackageFormState;
  ownerStats: { active: number; remaining: number };
  redeemedCount: number;
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

/**
 * One thin line between the header and section tabs — same pattern as Services
 * and Workshops. Labels stay in screen-reader text; the strip reads as values.
 */
export function PackageSummaryStrip({ form, ownerStats, redeemedCount }: Props) {
  const expiry =
    form.expirationMode === "none"
      ? "No expiration"
      : form.expirationMode === "days"
        ? `${form.expirationDays} days`
        : form.expirationDate || "Fixed date";

  return (
    <div className="ws-meta-strip" aria-label="Package summary">
      <MetaItem icon={Wallet} label="Price" value={formatMoney(form.priceCents)} />
      <MetaItem icon={Layers} label="Includes" value={`${form.totalCredits} credits`} />
      <MetaItem icon={Users} label="Owners" value={`${ownerStats.active} active`} />
      <MetaItem icon={Ticket} label="Remaining" value={`${ownerStats.remaining} credits`} />
      <MetaItem icon={Ticket} label="Redeemed" value={String(redeemedCount)} />
      <MetaItem icon={CalendarClock} label="Expiry" value={expiry} />
    </div>
  );
}
