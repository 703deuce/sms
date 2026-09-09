"use client";

import Link from "next/link";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { CancellationPolicy, ReschedulePolicy } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  newBookingQuestion,
  QUESTION_TYPE_OPTIONS,
  STAFF_ASSIGNMENT_OPTIONS,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import { EventTypeVideoSettings } from "@/components/video/event-type-video-settings";
import { EventTypeNotetakerSettings } from "@/components/meetings/event-type-notetaker-settings";

type SectionProps = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

type EditorOptions = {
  staffOptions: Array<{ id: string; name: string }>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
};

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ref-deco-section" aria-labelledby={id}>
      <div className="ref-deco-section-head">
        <div className="flex items-center gap-2">
          <div className="ref-deco-section-accent" aria-hidden />
          <div>
            <h2 id={id} className="appt-pilot-text-section">{title}</h2>
            {description ? <p className="appt-pilot-text-helper mt-0.5">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="ref-deco-section-body space-y-4">{children}</div>
    </section>
  );
}

function PilotLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="label block appt-pilot-text-list font-medium text-[var(--text-primary)] mb-1.5" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function PilotInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input w-full appt-pilot-text-list ${props.className || ""}`} />;
}

function PilotSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input w-full appt-pilot-text-list ${props.className || ""}`} />;
}

function PilotTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input w-full resize-none appt-pilot-text-list ${props.className || ""}`} />;
}

export function MeetingDetailsSection({ form, onFormChange }: SectionProps) {
  return (
    <SectionCard id="meeting-details" title="Details" description="Name and description customers see when booking.">
      <div>
        <PilotLabel htmlFor="meeting-name">Meeting name</PilotLabel>
        <PilotInput
          id="meeting-name"
          value={form.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          placeholder="Discovery call"
        />
      </div>
      <div>
        <PilotLabel htmlFor="meeting-description">Description</PilotLabel>
        <PilotTextarea
          id="meeting-description"
          rows={4}
          maxLength={500}
          value={form.description}
          onChange={(e) => onFormChange("description", e.target.value)}
          placeholder="What is this meeting for?"
        />
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
    </SectionCard>
  );
}

export function MeetingDurationSection({
  form,
  onFormChange,
  namedScheduleOptions,
}: SectionProps & { namedScheduleOptions: EditorOptions["namedScheduleOptions"] }) {
  return (
    <SectionCard
      id="meeting-duration"
      title="Duration & availability"
      description="How long the meeting runs and when customers can book."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <PilotLabel>Duration</PilotLabel>
          <div className="flex items-center gap-2">
            <PilotInput
              type="number"
              min={5}
              className="w-24"
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 30)}
            />
            <span className="appt-pilot-text-helper">min</span>
          </div>
        </div>
        <div>
          <PilotLabel>Minimum notice</PilotLabel>
          <div className="flex items-center gap-2">
            <PilotInput
              type="number"
              min={0}
              className="w-24"
              value={form.minimumBookingNoticeMinutes}
              onChange={(e) => onFormChange("minimumBookingNoticeMinutes", Number(e.target.value) || 0)}
            />
            <span className="appt-pilot-text-helper">min</span>
          </div>
        </div>
        <div>
          <PilotLabel>Book up to</PilotLabel>
          <div className="flex items-center gap-2">
            <PilotInput
              type="number"
              min={1}
              className="w-24"
              value={form.maximumBookingDaysAhead}
              onChange={(e) => onFormChange("maximumBookingDaysAhead", Number(e.target.value) || 14)}
            />
            <span className="appt-pilot-text-helper">days ahead</span>
          </div>
        </div>
      </div>
      <div>
        <PilotLabel>Availability schedule</PilotLabel>
        <PilotSelect
          value={form.namedScheduleId}
          onChange={(e) => onFormChange("namedScheduleId", e.target.value)}
        >
          <option value="">Workspace default hours</option>
          {namedScheduleOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </PilotSelect>
        <p className="mt-2 appt-pilot-text-helper">
          Set when customers can book this meeting.{" "}
          <Link href="/appointments/availability" className="appt-pilot-muted-link">
            Manage availability
          </Link>
        </p>
      </div>
    </SectionCard>
  );
}

export function MeetingHostsSection({
  form,
  onFormChange,
  staffOptions,
}: SectionProps & { staffOptions: EditorOptions["staffOptions"] }) {
  const showStaffPool =
    form.staffAssignment === "round_robin" ||
    form.staffAssignment === "maximize_availability" ||
    form.staffAssignment === "specific_staff" ||
    form.staffAssignment === "customer_chooses";
  const showCollective = form.staffAssignment === "collective";

  function toggleStaffId(id: string, listKey: "staffIds" | "collectiveStaffIds") {
    const current = form[listKey];
    onFormChange(
      listKey,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <SectionCard id="meeting-hosts" title="Hosts" description="Who can take this meeting?">
      <div className="grid gap-2">
        {STAFF_ASSIGNMENT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              form.staffAssignment === opt.value
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                : "border-[var(--border)]"
            }`}
          >
            <input
              type="radio"
              name="staffAssignment"
              checked={form.staffAssignment === opt.value}
              onChange={() => onFormChange("staffAssignment", opt.value)}
              className="mt-0.5"
            />
            <div>
              <p className="appt-pilot-text-list font-medium">{opt.label}</p>
              <p className="appt-pilot-text-helper">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
      {staffOptions.length === 0 ? (
        <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
          No hosts yet.{" "}
          <Link href="/appointments/staff" className="appt-pilot-muted-link">Add host</Link>
        </p>
      ) : (showStaffPool || showCollective) ? (
        <div className="flex flex-wrap gap-2">
          {staffOptions.map((s) => {
            const selected = showCollective
              ? form.collectiveStaffIds.includes(s.id)
              : form.staffIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`rounded-full px-3 py-1 appt-pilot-text-helper font-medium border transition-colors ${
                  selected
                    ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                    : "bg-white text-[var(--text-primary)] border-[var(--border)]"
                }`}
                onClick={() => toggleStaffId(s.id, showCollective ? "collectiveStaffIds" : "staffIds")}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </SectionCard>
  );
}

export function MeetingMethodSection({ form, onFormChange }: SectionProps) {
  return (
    <SectionCard id="meeting-method" title="Meeting method" description="Where will this meeting happen?">
      <div>
        <PilotLabel>Location or video</PilotLabel>
        <PilotSelect
          value={form.location}
          onChange={(e) => {
            const value = e.target.value;
            onFormChange("location", value);
            onFormChange("transovoVideoEnabled", value === "Transovo Video");
            const external =
              value === "Zoom" ||
              value === "Google Meet" ||
              value === "Microsoft Teams" ||
              value === "Webex" ||
              value === "Custom meeting link";
            if (external) {
              onFormChange("notetakerEnabled", true);
              onFormChange("notetakerAutoJoin", true);
            }
          }}
        >
          <option value="">Select method</option>
          <option value="In person">In person</option>
          <option value="Phone call">Phone call</option>
          <option value="Transovo Video">Transovo Video</option>
          <option value="Zoom">Zoom</option>
          <option value="Google Meet">Google Meet</option>
          <option value="Microsoft Teams">Microsoft Teams</option>
          <option value="Webex">Webex</option>
          <option value="Custom meeting link">Custom meeting link</option>
        </PilotSelect>
        {form.location === "Transovo Video" ? (
          <p className="mt-2 appt-pilot-text-helper">
            Join details are created automatically for each booking.
          </p>
        ) : null}
      </div>
      <EventTypeVideoSettings form={form} onChange={onFormChange} />
      <EventTypeNotetakerSettings form={form} onChange={onFormChange} />
      {(form.location === "Microsoft Teams" || form.location === "Google Meet") ? (
        <p className="appt-pilot-text-helper">
          Connect your calendar under{" "}
          <Link href="/integrations" className="appt-pilot-muted-link">Integrations</Link> if meetings are not created automatically.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function MeetingQuestionsSection({ form, onFormChange }: SectionProps) {
  const questions = form.bookingQuestions;

  function updateQuestion(index: number, patch: Partial<typeof questions[number]>) {
    onFormChange("bookingQuestions", questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  return (
    <SectionCard id="meeting-questions" title="Questions" description="Information to collect when someone books.">
      {questions.length === 0 ? (
        <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center">
          No custom questions — name and email are collected by default.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-[var(--border)] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-[var(--text-secondary)] shrink-0" aria-hidden />
                <PilotInput
                  placeholder="Question"
                  value={q.label}
                  onChange={(e) => updateQuestion(index, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="text-[var(--text-secondary)] hover:text-[var(--state-error)]"
                  onClick={() => onFormChange("bookingQuestions", questions.filter((_, i) => i !== index))}
                  aria-label="Remove question"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <label className="flex items-center gap-2 appt-pilot-text-helper">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="appt-pilot-muted-link flex items-center gap-1"
        onClick={() => onFormChange("bookingQuestions", [...questions, newBookingQuestion()])}
      >
        <Plus size={14} aria-hidden /> Add question
      </button>
    </SectionCard>
  );
}

export function MeetingRulesSection({ form, onFormChange }: SectionProps) {
  return (
    <SectionCard id="meeting-rules" title="Booking rules" description="Limits and policies for this meeting.">
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={form.bookingApprovalRequired}
          onChange={(e) => onFormChange("bookingApprovalRequired", e.target.checked)}
        />
        Require approval before confirming
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel>Cancellation</PilotLabel>
          <PilotSelect
            value={form.cancellationPolicy.allowed}
            onChange={(e) =>
              onFormChange("cancellationPolicy", {
                ...form.cancellationPolicy,
                allowed: e.target.value as CancellationPolicy["allowed"],
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
                allowed: e.target.value as ReschedulePolicy["allowed"],
              })
            }
          >
            <option value="anytime">Anytime</option>
            <option value="until_hours_before">Until hours before</option>
            <option value="disabled">Not allowed</option>
          </PilotSelect>
        </div>
      </div>
      <details className="appt-pilot-text-helper">
        <summary className="cursor-pointer font-medium text-[var(--text-primary)]">Advanced rules</summary>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.recurringEnabled}
              onChange={(e) => onFormChange("recurringEnabled", e.target.checked)}
            />
            Allow customers to book recurring meetings
          </label>
        </div>
      </details>
    </SectionCard>
  );
}

export function MeetingPaymentSection({
  form,
  onFormChange,
  connectedPaymentProviders,
}: SectionProps & { connectedPaymentProviders: EditorOptions["connectedPaymentProviders"] }) {
  const hasProvider = connectedPaymentProviders.length > 0;
  return (
    <SectionCard id="meeting-payment" title="Payment" description="Optional — collect payment when customers book.">
      <div>
        <PilotLabel>Payment mode</PilotLabel>
        <PilotSelect
          value={form.paymentMode}
          onChange={(e) => onFormChange("paymentMode", e.target.value as AppointmentTypeFormState["paymentMode"])}
        >
          <option value="none">Free</option>
          <option value="full">Full payment</option>
          <option value="deposit">Deposit</option>
          <option value="optional">Optional payment</option>
        </PilotSelect>
      </div>
      {form.paymentMode !== "none" && !hasProvider ? (
        <p className="appt-pilot-text-helper rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
          Connect Stripe or Square to collect payment for this meeting.{" "}
          <Link href="/settings/business" className="appt-pilot-muted-link">Connect payment provider</Link>
        </p>
      ) : null}
      {form.paymentMode !== "none" && hasProvider ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <PilotLabel>Provider</PilotLabel>
            <PilotSelect
              value={form.paymentProvider}
              onChange={(e) => onFormChange("paymentProvider", e.target.value as "stripe" | "square")}
            >
              <option value="">Select</option>
              {connectedPaymentProviders.map((p) => (
                <option key={p.provider} value={p.provider}>{p.label}</option>
              ))}
            </PilotSelect>
          </div>
          <div>
            <PilotLabel>Price (cents)</PilotLabel>
            <PilotInput
              type="number"
              min={0}
              value={form.paymentPriceCents}
              onChange={(e) => onFormChange("paymentPriceCents", Number(e.target.value) || 0)}
            />
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export function MeetingConfirmationSection({ form, onFormChange, bookingLink }: SectionProps & { bookingLink: string | null }) {
  return (
    <SectionCard id="meeting-confirmation" title="Confirmation" description="What customers see after booking.">
      <div>
        <PilotLabel>Confirmation headline</PilotLabel>
        <PilotInput
          value={form.confirmationHeadline}
          onChange={(e) => onFormChange("confirmationHeadline", e.target.value)}
          placeholder="You're booked!"
        />
      </div>
      <div>
        <PilotLabel>Confirmation message</PilotLabel>
        <PilotTextarea
          rows={3}
          value={form.confirmationBodyHtml}
          onChange={(e) => onFormChange("confirmationBodyHtml", e.target.value)}
          placeholder="Thanks for booking. We look forward to meeting you."
        />
      </div>
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => onFormChange("enabled", e.target.checked)}
        />
        Active — customers can book this meeting
      </label>
      {bookingLink ? (
        <p className="appt-pilot-text-helper break-all">
          Booking link: <span className="text-[var(--brand-accent)]">{bookingLink}</span>
        </p>
      ) : null}
    </SectionCard>
  );
}
