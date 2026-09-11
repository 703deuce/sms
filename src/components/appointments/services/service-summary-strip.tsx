"use client";

import { CalendarClock, Clock, MapPin, Tag, Users } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  serviceLocationSummary,
  servicePriceLabel,
  serviceStaffSummary,
} from "@/lib/appointments/services/service-display";
import { formatDurationMinutes } from "@/lib/appointments/duration-display";
import type { NextAvailable } from "@/features/appointments/kimi/services/use-next-available";

type Props = {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  phaseTotalMinutes: number;
  nextAvailable: NextAvailable;
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
    <span className="ws-meta-item">
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <strong>{value}</strong>
    </span>
  );
}

function staffValue(form: AppointmentTypeFormState, staffNames: Map<string, string>): string {
  const ids =
    form.staffAssignment === "collective" ? form.collectiveStaffIds : form.staffIds;
  if (ids.length > 1) return `${ids.length} assigned`;
  return serviceStaffSummary(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );
}

function locationValue(
  form: AppointmentTypeFormState,
  locationNames: Map<string, string>,
): string {
  if (form.locationIds.length > 1) return `${form.locationIds.length} locations`;
  return serviceLocationSummary(
    { locationIds: form.locationIds, locationId: form.locationId, location: form.location },
    locationNames,
  );
}

/**
 * A single line of the facts an operator checks constantly. It stays one line
 * because it sits between the header and the section tabs, and anything taller
 * pushes the actual work below the fold.
 */
export function ServiceSummaryStrip({
  form,
  staffNames,
  locationNames,
  phaseTotalMinutes,
  nextAvailable,
}: Props) {
  // Phases are the authoritative duration when present — the same rule the
  // slot engine applies — so the strip must not report the base duration.
  const duration = phaseTotalMinutes > 0 ? phaseTotalMinutes : form.durationMinutes;

  return (
    <div className="ws-meta-strip" aria-label="Service summary">
      <MetaItem
        icon={Clock}
        label="Duration"
        value={
          phaseTotalMinutes > 0
            ? `${formatDurationMinutes(duration)} · phased`
            : formatDurationMinutes(duration)
        }
      />
      <MetaItem icon={Users} label="Staff" value={staffValue(form, staffNames)} />
      <MetaItem icon={MapPin} label="Location" value={locationValue(form, locationNames)} />
      <MetaItem
        icon={Tag}
        label="Price"
        value={servicePriceLabel({
          payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
          priceDisplay: form.priceDisplay,
        })}
      />
      <MetaItem icon={CalendarClock} label="Next available" value={nextAvailable.label} />
    </div>
  );
}
