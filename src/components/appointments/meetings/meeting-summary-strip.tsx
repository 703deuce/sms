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
    <div className="ws-kpi-strip" aria-label="Meeting summary">
      <KpiCell icon={Clock} label="Duration" value={formatDurationMinutes(form.durationMinutes)} />
      <KpiCell icon={User} label="Host" value={host} />
      <KpiCell icon={Video} label="Method" value={method} unset={method === "Not set"} />
      <KpiCell icon={Calendar} label="Availability" value={schedule} />
      <KpiCell icon={DollarSign} label="Price" value={price} />
    </div>
  );
}
