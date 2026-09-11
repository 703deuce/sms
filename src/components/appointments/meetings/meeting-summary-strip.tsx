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

function KpiCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="ws-kpi-cell">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
        <p className="ws-kpi-label">{label}</p>
      </div>
      <p className="ws-kpi-value truncate">{value}</p>
    </div>
  );
}

export function MeetingSummaryStrip({ form, staffNames, namedScheduleOptions }: Props) {
  const host = hostAssignmentLabel(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );

  return (
    <div className="ws-kpi-strip" aria-label="Meeting summary">
      <KpiCell icon={Clock} label="Duration" value={formatDurationMinutes(form.durationMinutes)} />
      <KpiCell icon={User} label="Host" value={host} />
      <KpiCell icon={Video} label="Method" value={meetingMethodLabel({ location: form.location })} />
      <KpiCell
        icon={Calendar}
        label="Availability"
        value={availabilityScheduleLabel(form.namedScheduleId, namedScheduleOptions)}
      />
      <KpiCell
        icon={DollarSign}
        label="Price"
        value={priceLabel({
          payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
        })}
      />
    </div>
  );
}
