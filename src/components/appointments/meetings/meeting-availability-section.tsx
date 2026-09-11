"use client";

import Link from "next/link";
import { CalendarClock, CalendarRange, Timer } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { Field, NumberField, SectionCard, SelectInput } from "./meeting-ui";

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  namedScheduleOptions: Array<{ id: string; name: string }>;
};

export function MeetingAvailabilitySection({ form, onFormChange, namedScheduleOptions }: Props) {
  return (
    <div className="space-y-4">
      <SectionCard
        id="meeting-length"
        title="Length & buffers"
        description="How much of the calendar each booking consumes."
        icon={Timer}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duration" htmlFor="av-duration" hint="Shown to customers on the booking page.">
            <NumberField
              id="av-duration"
              suffix="min"
              min={5}
              step={5}
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 30)}
            />
          </Field>
          <Field label="Buffer after" htmlFor="av-buffer" hint="Blocked off before the next booking.">
            <NumberField
              id="av-buffer"
              suffix="min"
              min={0}
              step={5}
              value={form.bufferMinutes}
              onChange={(e) => onFormChange("bufferMinutes", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="meeting-window"
        title="Booking window"
        description="How far ahead — and how soon — customers can book."
        icon={CalendarRange}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Minimum notice"
            htmlFor="av-notice"
            hint="Slots closer than this are hidden."
          >
            <NumberField
              id="av-notice"
              suffix="min"
              min={0}
              step={15}
              value={form.minimumBookingNoticeMinutes}
              onChange={(e) =>
                onFormChange("minimumBookingNoticeMinutes", Number(e.target.value) || 0)
              }
            />
          </Field>
          <Field label="Book up to" htmlFor="av-ahead" hint="The furthest date customers can pick.">
            <NumberField
              id="av-ahead"
              suffix="days"
              min={1}
              value={form.maximumBookingDaysAhead}
              onChange={(e) => onFormChange("maximumBookingDaysAhead", Number(e.target.value) || 14)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="meeting-schedule"
        title="Availability schedule"
        description="The hours this meeting can be booked within."
        icon={CalendarClock}
      >
        <Field
          label="Schedule"
          htmlFor="av-schedule"
          hint={
            <>
              Slots are the overlap of this schedule and each host&apos;s calendar.{" "}
              <Link href="/appointments/availability" className="appt-pilot-muted-link">
                Manage schedules
              </Link>
            </>
          }
        >
          <SelectInput
            id="av-schedule"
            value={form.namedScheduleId}
            onChange={(e) => onFormChange("namedScheduleId", e.target.value)}
          >
            <option value="">Workspace default hours</option>
            {namedScheduleOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </SectionCard>
    </div>
  );
}
