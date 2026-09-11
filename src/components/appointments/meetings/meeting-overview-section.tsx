"use client";

import { ArrowUpRight, Check, Circle, Copy, ExternalLink, Eye, FileText, Globe } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  formatDurationMinutes,
  hostAssignmentLabel,
  meetingMethodLabel,
  priceLabel,
} from "@/lib/appointments/meetings/meeting-display";
import { meetingSetupSteps, setupCompletion } from "@/lib/appointments/meetings/meeting-setup";
import type { MeetingSectionId } from "./meeting-section-types";
import { Field, NumberField, SectionCard, TextArea, TextInput } from "@/components/appointments/workspace-ui";

type Props = {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  bookingLink: string | null;
  copied: boolean;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onNavigateSection: (id: MeetingSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
};

export function MeetingOverviewSection({
  form,
  staffNames,
  bookingLink,
  copied,
  onFormChange,
  onNavigateSection,
  onPreview,
  onCopyLink,
}: Props) {
  const host = hostAssignmentLabel(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );
  const method = meetingMethodLabel({ location: form.location });
  const steps = meetingSetupSteps(form);
  const { done, total } = setupCompletion(steps);
  const complete = done === total;

  const price = priceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
  });

  return (
    <div className="ws-section-col">
      <div className="ws-customer-preview-row">
        <span className="ws-customer-preview-label">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Customer sees
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
          <strong className="font-semibold">{form.name.trim() || "Untitled meeting"}</strong>
          {` · ${formatDurationMinutes(form.durationMinutes)} · ${method} · ${host} · ${price}`}
        </span>
        {bookingLink ? (
          <span className="flex shrink-0 items-center gap-3">
            <button type="button" className="ws-text-btn" onClick={onPreview}>
              <ExternalLink className="h-3 w-3" aria-hidden />
              Open booking page
            </button>
            <button type="button" className="ws-text-btn" onClick={onCopyLink}>
              {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </span>
        ) : (
          <span className="shrink-0 text-[var(--text-tertiary)]">Save for link</span>
        )}
      </div>

      {/*
       * The checklist keeps its jump-to-fix behaviour, but as one line of
       * chips rather than a rail. An incomplete step is a button carrying its
       * blocker as the tooltip, so nothing that was explained in the old card
       * is lost.
       */}
      <div className="ws-setup-progress" aria-label="Meeting setup progress">
        <span className="font-medium text-[var(--text-primary)]">
          Setup {done}/{total}
        </span>
        {steps.map((step) =>
          step.done ? (
            <span key={step.id} className="done">
              <Check className="mr-1 inline h-3 w-3" aria-hidden />
              {step.label}
              <span className="sr-only"> complete</span>
            </span>
          ) : (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigateSection(step.section)}
              title={step.blocker || `Go to ${step.label}`}
            >
              <Circle className="mr-1 inline h-3 w-3" aria-hidden />
              {step.label}
              <span className="sr-only"> incomplete — go to section</span>
              <ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden />
            </button>
          ),
        )}
        {complete ? null : (
          <span className="sr-only">{total - done} steps remaining</span>
        )}
      </div>

      <SectionCard
        id="overview-details"
        title="Meeting details"
        description="The name, length and description customers see."
        icon={FileText}
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="ov-name">
            <TextInput
              id="ov-name"
              value={form.name}
              placeholder="Discovery call"
              onChange={(e) => onFormChange("name", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration" htmlFor="ov-duration">
              <NumberField
                id="ov-duration"
                suffix="min"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 30)}
              />
            </Field>
          </div>
          <Field
            label="Description"
            htmlFor="ov-desc"
            hint="Shown under the meeting name on your booking page."
          >
            <TextArea
              id="ov-desc"
              rows={3}
              maxLength={500}
              placeholder="What is this meeting for?"
              value={form.description}
              onChange={(e) => onFormChange("description", e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="overview-public"
        title="Public booking"
        description="Where customers go to book this meeting."
        icon={Globe}
      >
        {bookingLink ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="ws-default-field min-w-0 flex-1">
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{bookingLink}</span>
            </span>
            <button type="button" className="appt-pilot-outline-btn shrink-0" onClick={onPreview}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              View booking page
            </button>
            <button type="button" className="appt-pilot-outline-btn shrink-0" onClick={onCopyLink}>
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : (
          <p className="ws-field-hint">
            Save this meeting to generate its shareable booking link.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
