"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  serviceLocationSummary,
  servicePriceLabel,
  serviceStaffSummary,
} from "@/lib/appointments/services/service-display";

type Props = {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
};

function formatDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}

function scheduleLabel(
  namedScheduleId: string,
  options: Array<{ id: string; name: string }>,
): string {
  if (!namedScheduleId) return "Workspace default";
  return options.find((o) => o.id === namedScheduleId)?.name || "Custom schedule";
}

export function ServiceSummaryStrip({
  form,
  staffNames,
  locationNames,
  namedScheduleOptions,
}: Props) {
  const configView = {
    staffAssignment: form.staffAssignment,
    staffIds: form.staffIds,
    collectiveStaffIds: form.collectiveStaffIds,
    locationIds: form.locationIds,
    locationId: form.locationId,
    location: form.location,
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
    priceDisplay: form.priceDisplay,
  };

  const parts = [
    formatDuration(form.durationMinutes),
    serviceStaffSummary(configView, staffNames),
    serviceLocationSummary(configView, locationNames),
    servicePriceLabel(configView),
    scheduleLabel(form.namedScheduleId, namedScheduleOptions),
  ];

  return (
    <div className="ws-meta-strip" aria-label="Service summary">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span className="text-[var(--text-tertiary)]"> · </span> : null}
          <strong>{part}</strong>
        </span>
      ))}
    </div>
  );
}
