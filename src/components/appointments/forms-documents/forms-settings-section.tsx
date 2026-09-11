"use client";

import Link from "next/link";

export function FormsSettingsSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel p-4">
        <h2 className="text-sm font-semibold">Platform terms</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Global terms acceptance during booking is configured in service booking settings, separate from per-form
          intake.
        </p>
        <Link href="/appointments/policies" className="ws-text-btn mt-3 inline-flex">
          Booking policies &amp; terms
        </Link>
      </div>
      <div className="ws-panel p-4">
        <h2 className="text-sm font-semibold">Reminders</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Incomplete document reminders use the canonical Reminders / Workflows system — not a separate sender on
          this page.
        </p>
        <Link href="/appointments/reminders" className="ws-text-btn mt-3 inline-flex">
          Manage reminders
        </Link>
      </div>
    </div>
  );
}
