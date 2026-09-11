"use client";

import { Calendar, Clock, DollarSign, User, Video } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  availabilityScheduleLabel,
  formatDurationMinutes,
  hostAssignmentLabel,
  meetingMethodLabel,
  priceLabel,
} from "@/lib/appointments/meetings/meeting-display";

type Props = {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
};

function MetaItem({
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
    <span className="ws-meta-item" title={value}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <strong className={unset ? "is-unset" : undefined}>{value}</strong>
    </span>
  );
}

/**
 * A single line of the facts an operator checks constantly. It stays one line
 * because it sits between the header and the section tabs, and anything taller
 * pushes the actual work below the fold.
 */
export function MeetingSummaryStrip({ form, staffNames, namedScheduleOptions }: Props) {
  const host = hostAssignmentLabel(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );
  const method = meetingMethodLabel({ location: form.location });
  const schedule = availabilityScheduleLabel(form.namedScheduleId, namedScheduleOptions);
  const price = priceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
  });

  return (
    <div className="ws-meta-strip" aria-label="Meeting summary">
      <MetaItem icon={Clock} label="Duration" value={formatDurationMinutes(form.durationMinutes)} />
      <MetaItem icon={User} label="Host" value={host} />
      <MetaItem icon={Video} label="Method" value={method} unset={method === "Not set"} />
      <MetaItem icon={Calendar} label="Availability" value={schedule} />
      <MetaItem icon={DollarSign} label="Price" value={price} />
    </div>
  );
}
