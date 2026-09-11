"use client";

import { CalendarClock, Layers, Ticket, Users, Wallet } from "lucide-react";
import type { PackageFormState } from "@/lib/appointments/packages/package-form";
import { formatMoney } from "@/lib/appointments/packages/package-form";

type Props = {
  form: PackageFormState;
  ownerStats: { active: number; remaining: number };
  redeemedCount: number;
};

export function PackageSummaryStrip({ form, ownerStats, redeemedCount }: Props) {
  const expiry =
    form.expirationMode === "none"
      ? "No expiration"
      : form.expirationMode === "days"
        ? `${form.expirationDays} days`
        : form.expirationDate || "Fixed date";

  const cells = [
    { icon: Wallet, label: "Price", value: formatMoney(form.priceCents) },
    { icon: Layers, label: "Includes", value: `${form.totalCredits} credits` },
    { icon: Users, label: "Owners", value: `${ownerStats.active} active` },
    { icon: Ticket, label: "Remaining", value: `${ownerStats.remaining} credits` },
    { icon: Ticket, label: "Redeemed", value: String(redeemedCount) },
    { icon: CalendarClock, label: "Expiry", value: expiry },
  ];

  return (
    <div className="ws-summary-strip" role="group" aria-label="Package summary">
      {cells.map((cell) => (
        <div key={cell.label} className="ws-summary-cell" title={cell.value}>
          <cell.icon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
          <span className="ws-summary-cell-label">{cell.label}</span>
          <span className="ws-summary-cell-value">{cell.value}</span>
        </div>
      ))}
    </div>
  );
}
