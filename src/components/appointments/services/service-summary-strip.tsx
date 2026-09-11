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

function KpiCell({
  icon: Icon,
  label,
  value,
  unset,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unset?: boolean;
}) {
  return (
    <div className="ws-kpi-cell">
      <p className="ws-kpi-label">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </p>
      {/* title carries the full string because narrow columns must ellipsize */}
      <p className={`ws-kpi-value${unset ? " is-unset" : ""}`} title={value}>
        {value}
      </p>
    </div>
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
  const location = locationValue(form, locationNames);
  const price = servicePriceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
    priceDisplay: form.priceDisplay,
  });

  return (
    <div className="ws-kpi-strip" aria-label="Service summary">
      <KpiCell
        icon={Clock}
        label="Duration"
        value={
          phaseTotalMinutes > 0
            ? `${formatDurationMinutes(duration)} · phased`
            : formatDurationMinutes(duration)
        }
      />
      <KpiCell icon={Users} label="Staff" value={staffValue(form, staffNames)} />
      <KpiCell icon={MapPin} label="Location" value={location} unset={location === "—"} />
      <KpiCell icon={Tag} label="Price" value={price} />
      <KpiCell
        icon={CalendarClock}
        label="Next available"
        value={nextAvailable.label}
        unset={nextAvailable.state !== "ready"}
      />
    </div>
  );
}
