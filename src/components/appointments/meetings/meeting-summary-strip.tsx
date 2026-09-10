"use client";

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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 px-3 py-2 first:pl-0 last:pr-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function MeetingSummaryStrip({ form, staffNames, namedScheduleOptions }: Props) {
  const hostIds = form.staffAssignment === "collective" ? form.collectiveStaffIds : form.staffIds;
  const hostName =
    hostIds.length === 1
      ? staffNames.get(hostIds[0]) || "1 host"
      : hostIds.length > 1
        ? `${hostIds.length} hosts`
        : hostAssignmentLabel(
            {
              staffAssignment: form.staffAssignment,
              staffIds: form.staffIds,
              collectiveStaffIds: form.collectiveStaffIds,
            },
            staffNames,
          ).split("·")[0]?.trim() || "Any host";

  return (
    <div
      className="flex flex-wrap items-stretch divide-x divide-[var(--border)] border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-1 sm:px-6"
      aria-label="Meeting summary"
    >
      <Cell label="Duration" value={formatDurationMinutes(form.durationMinutes)} />
      <Cell label="Host" value={hostName} />
      <Cell label="Method" value={meetingMethodLabel({ location: form.location })} />
      <Cell
        label="Availability"
        value={availabilityScheduleLabel(form.namedScheduleId, namedScheduleOptions)}
      />
      <Cell
        label="Price"
        value={priceLabel({
          payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
        })}
      />
    </div>
  );
}
