"use client";

import Link from "next/link";
import type { StaffRoutingConfig } from "@/lib/appointments/types";

type Props = {
  staffRouting: StaffRoutingConfig;
  saving: boolean;
  onChange: (patch: { staffRouting: StaffRoutingConfig }) => void;
};

export function RoutingSettingsSection({ staffRouting, saving, onChange }: Props) {
  const reschedule = staffRouting.rescheduleWhenStaffUnavailable || "require_new_slot";

  return (
    <div className="space-y-4 p-4 lg:px-6 text-xs">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          When current staff is unavailable after reschedule
        </h2>
        <div className="mt-2 space-y-1">
          {(
            [
              ["require_new_slot", "Ask customer to choose another time"],
              ["auto_reroute", "Automatically assign another eligible staff member"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 ${
                reschedule === value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="reschedule"
                checked={reschedule === value}
                disabled={saving}
                onChange={() =>
                  onChange({
                    staffRouting: { ...staffRouting, rescheduleWhenStaffUnavailable: value },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[var(--text-secondary)]">
          Reschedule runtime must honor this policy before rerouting silently.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Load calculation
        </h2>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(staffRouting.countManualTowardBalance)}
            disabled={saving}
            onChange={(e) =>
              onChange({
                staffRouting: { ...staffRouting, countManualTowardBalance: e.target.checked },
              })
            }
          />
          Include manually booked appointments in round-robin balance
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(staffRouting.countCancelledTowardBalance)}
            disabled={saving}
            onChange={(e) =>
              onChange({
                staffRouting: { ...staffRouting, countCancelledTowardBalance: e.target.checked },
              })
            }
          />
          Count cancelled routed bookings toward balance
        </label>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Answer-based appointment type routing
        </h2>
        <p className="mt-1 text-[var(--text-secondary)]">
          Rules that send customers to a different appointment type based on booking answers live separately from staff
          assignment.
        </p>
        <Link href="/appointments/routing-forms" className="appt-pilot-text-btn mt-2 inline-block">
          Open routing forms
        </Link>
        <Link href="/appointments/routing?section=type-rules" className="appt-pilot-text-btn mt-2 ml-3 inline-block">
          Legacy type rules
        </Link>
      </section>
    </div>
  );
}
