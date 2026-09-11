"use client";

import Link from "next/link";
import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";

type Props = {
  serviceId: string | null;
  data: RoutingWorkspacePayload;
  onClose: () => void;
};

export function RoutingServiceDrawer({ serviceId, data, onClose }: Props) {
  if (!serviceId) return null;
  const row = data.services.find((s) => s.id === serviceId);
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Service</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{row.name}</h2>
          </div>
          <button type="button" className="appt-pilot-icon-btn" onClick={onClose} aria-label="Close drawer">×</button>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <div>
            <dt className="text-[var(--text-secondary)]">Customer experience</dt>
            <dd className="font-medium">{row.customerSelection}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Method</dt>
            <dd className="font-medium">{row.methodLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Eligible staff</dt>
            <dd className="font-medium">{row.eligibleStaff}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Locations</dt>
            <dd className="font-medium">{row.locationCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Availability</dt>
            <dd>Uses canonical staff / location availability</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/appointments/services?type=${row.id}`} className="appt-pilot-primary-btn text-xs">
            Open service
          </Link>
          <Link href="/appointments/availability" className="appt-pilot-secondary-btn text-xs">
            Open availability
          </Link>
        </div>
      </div>
    </div>
  );
}
