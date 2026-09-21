"use client";

import { buildCallScreeningUi } from "@/lib/voice/calls/screening-display";

export function CallScreeningSection({
  metadata,
  outcome,
}: {
  metadata?: unknown;
  outcome?: string | null;
}) {
  const ui = buildCallScreeningUi({ metadata, outcome });
  if (!ui.showSection) return null;

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[#111827]">Call screening</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {ui.carrierLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b7280]">Carrier screening</dt>
            <dd className="font-medium text-[#111827]">{ui.carrierLabel}</dd>
          </div>
        ) : null}
        {ui.outcomeLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b7280]">Call outcome</dt>
            <dd className="font-medium text-[#111827]">{ui.outcomeLabel}</dd>
          </div>
        ) : null}
        {ui.billingLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b7280]">Billing</dt>
            <dd className="font-medium text-[#111827]">{ui.billingLabel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
