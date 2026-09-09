"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { ClassScheduleState } from "@/features/appointments/kimi/classes/use-class-editor";
import type { ClassEditorOptions } from "@/features/appointments/kimi/classes/use-class-editor";
import { labelsForPresentation } from "@/lib/appointments/classes/class-labels";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
  SectionCard,
} from "@/components/appointments/meetings/meeting-editor-sections";
import {
  newBookingQuestion,
  QUESTION_TYPE_OPTIONS,
} from "@/features/appointments/kimi/shared/platform-settings-types";

type Props = {
  form: AppointmentTypeFormState;
  schedule: ClassScheduleState;
  isWorkshop: boolean;
  occurrencePreview: string[];
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onScheduleChange: <K extends keyof ClassScheduleState>(
    key: K,
    value: ClassScheduleState[K],
  ) => void;
  onPersistDraft?: () => void;
};

function ContextLink({
  href,
  children,
  onPersistDraft,
}: {
  href: string;
  children: React.ReactNode;
  onPersistDraft?: () => void;
}) {
  return (
    <Link href={href} className="appt-pilot-muted-link" onClick={() => onPersistDraft?.()}>
      {children}
    </Link>
  );
}

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function ClassGeneralSection({
  form,
  onFormChange,
  categoryOptions,
  isWorkshop,
  onPersistDraft,
}: Props & { categoryOptions: ClassEditorOptions["categoryOptions"] }) {
  const noun = isWorkshop ? "Workshop or event" : "Class";
  return (
    <SectionCard id="class-general" title="General" description={`What ${noun.toLowerCase()} are you offering?`}>
      <div>
        <PilotLabel htmlFor="class-name">{noun} name</PilotLabel>
        <PilotInput
          id="class-name"
          value={form.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          placeholder={isWorkshop ? "Photography Workshop" : "Morning Yoga"}
        />
      </div>
      <div>
        <PilotLabel htmlFor="class-description">Description</PilotLabel>
        <PilotTextarea
          id="class-description"
          rows={4}
          value={form.description}
          onChange={(e) => onFormChange("description", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel>Category</PilotLabel>
          <PilotSelect value={form.categoryId} onChange={(e) => onFormChange("categoryId", e.target.value)}>
            <option value="">No category</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </PilotSelect>
        </div>
        <div>
          <PilotLabel>Image URL</PilotLabel>
          <PilotInput
            type="url"
            value={form.imageUrl}
            onChange={(e) => onFormChange("imageUrl", e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>
      <div>
        <PilotLabel>Visibility</PilotLabel>
        <div className="grid grid-cols-3 gap-2">
          {(["public", "unlisted", "secret"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`appt-pilot-outline-btn capitalize ${form.visibility === v ? "!border-[var(--brand-accent)] !bg-[var(--brand-accent-soft)] !text-[var(--brand-accent)]" : ""}`}
              onClick={() => onFormChange("visibility", v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input type="checkbox" checked={form.enabled} onChange={(e) => onFormChange("enabled", e.target.checked)} />
        Active — customers can {isWorkshop ? "register" : "enroll"}
      </label>
    </SectionCard>
  );
}

export function ClassScheduleSection({
  form,
  schedule,
  isWorkshop,
  occurrencePreview,
  onFormChange,
  onScheduleChange,
}: Props) {
  const labels = labelsForPresentation(isWorkshop ? "workshop_event" : "recurring_class");
  return (
    <SectionCard
      id="class-schedule"
      title={labels.scheduleSection}
      description={labels.scheduleQuestion}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <PilotLabel>Start date</PilotLabel>
          <PilotInput
            type="date"
            value={schedule.startDate}
            onChange={(e) => onScheduleChange("startDate", e.target.value)}
          />
        </div>
        <div>
          <PilotLabel>Start time</PilotLabel>
          <PilotInput
            type="time"
            value={schedule.startTime}
            onChange={(e) => onScheduleChange("startTime", e.target.value)}
          />
        </div>
        <div>
          <PilotLabel>Duration</PilotLabel>
          <div className="flex items-center gap-2">
            <PilotInput
              type="number"
              min={15}
              className="w-24"
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 60)}
            />
            <span className="appt-pilot-text-helper">min</span>
          </div>
        </div>
      </div>

      {!isWorkshop ? (
        <>
          <div>
            <PilotLabel>Repeats on</PilotLabel>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const selected = schedule.weekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`rounded-full px-3 py-1 appt-pilot-text-helper font-medium border ${
                      selected
                        ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                        : "border-[var(--border)]"
                    }`}
                    onClick={() => {
                      const next = selected
                        ? schedule.weekdays.filter((d) => d !== day.value)
                        : [...schedule.weekdays, day.value];
                      onScheduleChange("weekdays", next);
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <PilotLabel>Generate upcoming sessions</PilotLabel>
            <PilotInput
              type="number"
              min={1}
              max={52}
              className="w-24"
              value={schedule.maxOccurrences}
              onChange={(e) => onScheduleChange("maxOccurrences", Number(e.target.value) || 12)}
            />
          </div>
        </>
      ) : (
        <p className="appt-pilot-text-helper rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
          Running this every week?{" "}
          <Link href="/appointments/types/classes/new" className="appt-pilot-muted-link">
            Create a Class instead
          </Link>
        </p>
      )}

      {occurrencePreview.length > 0 ? (
        <div>
          <PilotLabel>Upcoming dates</PilotLabel>
          <ul className="appt-pilot-text-list space-y-1">
            {occurrencePreview.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

export function ClassInstructorLocationSection({
  form,
  onFormChange,
  staffOptions,
  locationOptions,
  isWorkshop,
  onPersistDraft,
}: Props & {
  staffOptions: ClassEditorOptions["staffOptions"];
  locationOptions: ClassEditorOptions["locationOptions"];
}) {
  const hostLabel = labelsForPresentation(isWorkshop ? "workshop_event" : "recurring_class").hostLabel;
  const instructorId = form.staffIds[0] || "";

  return (
    <SectionCard
      id="class-instructor-location"
      title={`${hostLabel} & location`}
      description={`Who leads this ${isWorkshop ? "event" : "class"} and where does it happen?`}
    >
      <div>
        <PilotLabel>{hostLabel}</PilotLabel>
        {staffOptions.length === 0 ? (
          <p className="appt-pilot-text-helper">
            No staff yet.{" "}
            <ContextLink href="/appointments/staff" onPersistDraft={onPersistDraft}>Add instructor</ContextLink>
          </p>
        ) : (
          <PilotSelect
            value={instructorId}
            onChange={(e) => {
              onFormChange("staffIds", e.target.value ? [e.target.value] : []);
              onFormChange("staffAssignment", "specific_staff");
            }}
          >
            <option value="">Select {hostLabel.toLowerCase()}</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </PilotSelect>
        )}
      </div>
      <div>
        <PilotLabel>Location</PilotLabel>
        {locationOptions.length === 0 ? (
          <p className="appt-pilot-text-helper">
            No locations yet.{" "}
            <ContextLink href="/appointments/locations" onPersistDraft={onPersistDraft}>Add location</ContextLink>
          </p>
        ) : (
          <PilotSelect
            value={form.locationId || form.locationIds[0] || ""}
            onChange={(e) => {
              onFormChange("locationId", e.target.value);
              onFormChange("locationIds", e.target.value ? [e.target.value] : []);
            }}
          >
            <option value="">Select location</option>
            {locationOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </PilotSelect>
        )}
      </div>
    </SectionCard>
  );
}

export function ClassCapacitySection({ form, schedule, onFormChange, onScheduleChange, isWorkshop }: Props) {
  return (
    <SectionCard id="class-capacity" title="Capacity" description="How many people can join?">
      <div>
        <PilotLabel>Maximum attendees</PilotLabel>
        <PilotInput
          type="number"
          min={1}
          className="w-28"
          value={form.groupCapacity}
          onChange={(e) => onFormChange("groupCapacity", Number(e.target.value) || 10)}
        />
      </div>
      <div>
        <PilotLabel>Capacity display on booking page</PilotLabel>
        <PilotSelect
          value={schedule.capacityDisplayMode}
          onChange={(e) =>
            onScheduleChange(
              "capacityDisplayMode",
              e.target.value as ClassScheduleState["capacityDisplayMode"],
            )
          }
        >
          <option value="exact">Exact — show spots left</option>
          <option value="limited">General — limited availability</option>
          <option value="hidden">Hidden — show available only</option>
        </PilotSelect>
      </div>
      {!isWorkshop ? (
        <p className="appt-pilot-text-helper">
          Allow one customer to reserve spots for multiple attendees — configure in party size when enrolling.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function ClassPricingSection({
  form,
  onFormChange,
  connectedPaymentProviders,
  onPersistDraft,
}: Props & { connectedPaymentProviders: ClassEditorOptions["connectedPaymentProviders"] }) {
  const hasProvider = connectedPaymentProviders.length > 0;
  return (
    <SectionCard id="class-pricing" title="Pricing & access" description="What does this cost and who can join?">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel>Display price</PilotLabel>
          <PilotInput value={form.priceDisplay} onChange={(e) => onFormChange("priceDisplay", e.target.value)} />
        </div>
        <div>
          <PilotLabel>Payment collection</PilotLabel>
          <PilotSelect
            value={form.paymentMode}
            onChange={(e) => onFormChange("paymentMode", e.target.value as AppointmentTypeFormState["paymentMode"])}
          >
            <option value="none">Free</option>
            <option value="full">Full payment</option>
            <option value="deposit">Deposit</option>
            <option value="optional">Pay later / optional</option>
          </PilotSelect>
        </div>
      </div>
      {form.paymentMode !== "none" && !hasProvider ? (
        <p className="appt-pilot-text-helper">
          <ContextLink href="/settings/business" onPersistDraft={onPersistDraft}>Connect Stripe</ContextLink>
          {" · "}
          <ContextLink href="/settings/business" onPersistDraft={onPersistDraft}>Connect Square</ContextLink>
        </p>
      ) : null}
      <details className="rounded-xl border border-[var(--border)] px-4 py-3">
        <summary className="cursor-pointer appt-pilot-text-list font-medium">Packages & memberships</summary>
        <p className="mt-2 appt-pilot-text-helper">
          <ContextLink href="/appointments/packages" onPersistDraft={onPersistDraft}>Manage packages</ContextLink>
          {" · "}
          <ContextLink href="/appointments/memberships/new" onPersistDraft={onPersistDraft}>Create membership</ContextLink>
          {" · "}
          <ContextLink href="/appointments/packages/new" onPersistDraft={onPersistDraft}>Create package</ContextLink>
        </p>
      </details>
    </SectionCard>
  );
}

export function ClassCustomerInfoSection({
  form,
  onFormChange,
  intakeFormOptions,
  onPersistDraft,
}: Props & { intakeFormOptions: ClassEditorOptions["intakeFormOptions"] }) {
  const questions = form.bookingQuestions;
  return (
    <SectionCard id="class-customer-info" title="Customer information" description="What you need from attendees.">
      <div className="space-y-3">
        {questions.map((q, index) => (
          <div key={q.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
            <PilotInput
              className="flex-1"
              value={q.label}
              onChange={(e) => {
                const next = questions.map((row, i) =>
                  i === index ? { ...row, label: e.target.value } : row,
                );
                onFormChange("bookingQuestions", next);
              }}
            />
            <button
              type="button"
              onClick={() => onFormChange("bookingQuestions", questions.filter((_, i) => i !== index))}
              aria-label="Remove question"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="appt-pilot-muted-link flex items-center gap-1"
          onClick={() => onFormChange("bookingQuestions", [...questions, newBookingQuestion()])}
        >
          <Plus size={14} /> Add question
        </button>
      </div>
      <div className="mt-4">
        <PilotLabel>Intake form</PilotLabel>
        {intakeFormOptions.length === 0 ? (
          <p className="appt-pilot-text-helper">
            <ContextLink href="/appointments/commerce" onPersistDraft={onPersistDraft}>Create intake form</ContextLink>
          </p>
        ) : (
          <ul className="space-y-2">
            {intakeFormOptions.map((f) => (
              <li key={f.id}>
                <label className="flex items-center gap-2 appt-pilot-text-list">
                  <input
                    type="checkbox"
                    checked={form.intakeFormIds.includes(f.id)}
                    onChange={() => {
                      const current = form.intakeFormIds;
                      onFormChange(
                        "intakeFormIds",
                        current.includes(f.id) ? current.filter((x) => x !== f.id) : [...current, f.id],
                      );
                    }}
                  />
                  {f.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

export function ClassPoliciesSection({ form, onFormChange }: Props) {
  return (
    <SectionCard id="class-policies" title="Policies" description="Cancellation and attendance rules.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel>Cancellation</PilotLabel>
          <PilotSelect
            value={form.cancellationPolicy.allowed}
            onChange={(e) =>
              onFormChange("cancellationPolicy", {
                ...form.cancellationPolicy,
                allowed: e.target.value as typeof form.cancellationPolicy.allowed,
              })
            }
          >
            <option value="anytime">Anytime</option>
            <option value="until_hours_before">Until hours before</option>
            <option value="disabled">Not allowed</option>
          </PilotSelect>
        </div>
        <div>
          <PilotLabel>Rescheduling</PilotLabel>
          <PilotSelect
            value={form.reschedulePolicy.allowed}
            onChange={(e) =>
              onFormChange("reschedulePolicy", {
                ...form.reschedulePolicy,
                allowed: e.target.value as typeof form.reschedulePolicy.allowed,
              })
            }
          >
            <option value="anytime">Anytime</option>
            <option value="until_hours_before">Until hours before</option>
            <option value="disabled">Not allowed</option>
          </PilotSelect>
        </div>
      </div>
    </SectionCard>
  );
}

export function ClassWaitlistSection({ schedule, onScheduleChange }: Props) {
  return (
    <SectionCard id="class-waitlist" title="Waitlist" description="What happens when this session is full?">
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={schedule.waitlistEnabled}
          onChange={(e) => onScheduleChange("waitlistEnabled", e.target.checked)}
        />
        Enable waitlist when full
      </label>
      <p className="appt-pilot-text-helper">
        Customers can join the waitlist when capacity is reached. Priority is first come, first served.
      </p>
    </SectionCard>
  );
}

export function ClassAdmissionSection({ isWorkshop }: { isWorkshop: boolean }) {
  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-3">
      <summary className="cursor-pointer appt-pilot-text-list font-medium">Admission & check-in</summary>
      <p className="mt-2 appt-pilot-text-helper">
        Check-in is available from each {isWorkshop ? "event" : "class"} session page. QR tickets and seat maps are
        advanced features — configure when your workspace enables them.
      </p>
    </details>
  );
}
