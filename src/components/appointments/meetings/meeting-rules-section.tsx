"use client";

import { useState } from "react";
import { CalendarX2, Gauge, Repeat, ShieldCheck } from "lucide-react";
import type { CancellationPolicy, ReschedulePolicy } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { Field, Module, NumberField, SelectInput, Switch } from "./meeting-ui";

type ModuleId = "approval" | "changes" | "limits" | "recurring";

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

const POLICY_LABELS: Record<CancellationPolicy["allowed"], string> = {
  anytime: "Anytime",
  until_hours_before: "Up to a cutoff",
  disabled: "Not allowed",
};

function policySummary(policy: CancellationPolicy | ReschedulePolicy): string {
  if (policy.allowed === "anytime") return "anytime";
  if (policy.allowed === "disabled") return "not allowed";
  return `until ${policy.cutoffHours ?? 24}h before`;
}

export function MeetingRulesSection({ form, onFormChange }: Props) {
  const [open, setOpen] = useState<ModuleId | null>("approval");

  function toggle(id: ModuleId) {
    setOpen((current) => (current === id ? null : id));
  }

  const limitCount = [form.maxBookingsPerDay, form.maxBookingsPerWeek, form.maxBookingsPerMonth].filter(
    (v) => typeof v === "number" && v > 0,
  ).length;

  return (
    <div>
      <h2 className="ws-section-heading">Booking rules</h2>
      <p className="ws-section-sub">
        Policies applied to every booking of this meeting.
      </p>

      <div className="mt-4">
        <Module
          open={open === "approval"}
          onToggle={() => toggle("approval")}
          icon={ShieldCheck}
          title="Booking approval"
          value={
            form.bookingApprovalRequired
              ? "You confirm each request manually"
              : "Bookings confirm instantly"
          }
        >
          <Switch
            checked={form.bookingApprovalRequired}
            onChange={(v) => onFormChange("bookingApprovalRequired", v)}
            label="Require approval before confirming"
            description="Requests stay pending until you accept them. The customer is told their booking is awaiting confirmation."
          />
        </Module>

        <Module
          open={open === "changes"}
          onToggle={() => toggle("changes")}
          icon={CalendarX2}
          title="Cancellation & rescheduling"
          value={`Cancel ${policySummary(form.cancellationPolicy)} · Reschedule ${policySummary(
            form.reschedulePolicy,
          )}`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customers can cancel" htmlFor="rule-cancel">
              <SelectInput
                id="rule-cancel"
                value={form.cancellationPolicy.allowed}
                onChange={(e) =>
                  onFormChange("cancellationPolicy", {
                    ...form.cancellationPolicy,
                    allowed: e.target.value as CancellationPolicy["allowed"],
                  })
                }
              >
                {Object.entries(POLICY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {form.cancellationPolicy.allowed === "until_hours_before" ? (
              <Field label="Cancellation cutoff" htmlFor="rule-cancel-hours">
                <NumberField
                  id="rule-cancel-hours"
                  suffix="hours"
                  min={1}
                  value={form.cancellationPolicy.cutoffHours ?? 24}
                  onChange={(e) =>
                    onFormChange("cancellationPolicy", {
                      ...form.cancellationPolicy,
                      cutoffHours: Number(e.target.value) || 24,
                    })
                  }
                />
              </Field>
            ) : null}

            <Field label="Customers can reschedule" htmlFor="rule-resched">
              <SelectInput
                id="rule-resched"
                value={form.reschedulePolicy.allowed}
                onChange={(e) =>
                  onFormChange("reschedulePolicy", {
                    ...form.reschedulePolicy,
                    allowed: e.target.value as ReschedulePolicy["allowed"],
                  })
                }
              >
                {Object.entries(POLICY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {form.reschedulePolicy.allowed === "until_hours_before" ? (
              <Field label="Reschedule cutoff" htmlFor="rule-resched-hours">
                <NumberField
                  id="rule-resched-hours"
                  suffix="hours"
                  min={1}
                  value={form.reschedulePolicy.cutoffHours ?? 24}
                  onChange={(e) =>
                    onFormChange("reschedulePolicy", {
                      ...form.reschedulePolicy,
                      cutoffHours: Number(e.target.value) || 24,
                    })
                  }
                />
              </Field>
            ) : null}
          </div>
        </Module>

        <Module
          open={open === "limits"}
          onToggle={() => toggle("limits")}
          icon={Gauge}
          title="Booking limits"
          value={limitCount === 0 ? "No limits" : `${limitCount} limit${limitCount > 1 ? "s" : ""} set`}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Per day" htmlFor="rule-day" hint="0 for unlimited">
              <NumberField
                id="rule-day"
                suffix="max"
                min={0}
                value={form.maxBookingsPerDay ?? 0}
                onChange={(e) => onFormChange("maxBookingsPerDay", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Per week" htmlFor="rule-week" hint="0 for unlimited">
              <NumberField
                id="rule-week"
                suffix="max"
                min={0}
                value={form.maxBookingsPerWeek ?? 0}
                onChange={(e) => onFormChange("maxBookingsPerWeek", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Per month" htmlFor="rule-month" hint="0 for unlimited">
              <NumberField
                id="rule-month"
                suffix="max"
                min={0}
                value={form.maxBookingsPerMonth ?? 0}
                onChange={(e) => onFormChange("maxBookingsPerMonth", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </Module>

        <Module
          open={open === "recurring"}
          onToggle={() => toggle("recurring")}
          icon={Repeat}
          title="Recurring bookings"
          value={form.recurringEnabled ? "Customers can book a series" : "Single bookings only"}
        >
          <Switch
            checked={form.recurringEnabled}
            onChange={(v) => onFormChange("recurringEnabled", v)}
            label="Allow customers to book a repeating series"
            description="The booker chooses how often the meeting repeats when they schedule it."
          />
        </Module>
      </div>
    </div>
  );
}
