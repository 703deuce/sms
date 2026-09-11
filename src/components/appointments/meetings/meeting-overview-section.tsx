"use client";

import { ArrowUpRight, Check, Copy, ExternalLink, Eye, FileText, Globe } from "lucide-react";
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
  const { done, total, pct } = setupCompletion(steps);
  const complete = done === total;

  return (
    <div className="ws-overview-grid has-side">
      <div className="space-y-4">
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
            <>
              <div className="ws-default-field">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{bookingLink}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="appt-pilot-outline-btn" onClick={onPreview}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  View booking page
                </button>
                <button type="button" className="appt-pilot-outline-btn" onClick={onCopyLink}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </>
          ) : (
            <p className="ws-field-hint">
              Save this meeting to generate its shareable booking link.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="space-y-4">
        <div className="ws-preview-card">
          <div className="ws-preview-browser" aria-hidden>
            <span className="ws-preview-dot" />
            <span className="ws-preview-dot" />
            <span className="ws-preview-dot" />
            <span className="ml-1.5 truncate text-[0.625rem] text-[var(--text-tertiary)]">
              Customer view
            </span>
          </div>
          <div className="ws-preview-body">
            <p className="ws-side-card-label">
              <Eye className="h-3 w-3" aria-hidden />
              Customer sees
            </p>
            <p className="mt-2.5 text-[0.9375rem] font-semibold leading-snug text-[var(--text-primary)]">
              {form.name.trim() || "Untitled meeting"}
            </p>
            {form.description.trim() ? (
              <p className="mt-1 line-clamp-3 text-[var(--type-helper)] leading-relaxed text-[var(--text-secondary)]">
                {form.description}
              </p>
            ) : null}
            <dl className="mt-3 space-y-1.5 border-t border-[var(--border-soft)] pt-3 text-[var(--type-helper)]">
              {[
                ["Duration", formatDurationMinutes(form.durationMinutes)],
                ["Host", host],
                ["Method", method],
                [
                  "Price",
                  priceLabel({
                    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
                  }),
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-[var(--text-secondary)]">{label}</dt>
                  <dd className="truncate font-semibold text-[var(--text-primary)]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="ws-side-card">
          <div className="flex items-center justify-between gap-3">
            <p className="ws-side-card-label">Setup</p>
            <span className={`ws-chip ${complete ? "ws-chip-success" : "ws-chip-neutral"}`}>
              {done}/{total}
            </span>
          </div>
          <div className="ws-health-bar mt-2.5">
            <div
              className={`ws-health-fill${complete ? " is-complete" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="mt-3 space-y-2">
            {steps.map((step) => (
              <li key={step.id}>
                <div className={`ws-checklist-item${step.done ? " done" : ""}`}>
                  <span className="ws-checklist-mark" aria-hidden>
                    {step.done ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                  <span className="min-w-0 truncate">{step.label}</span>
                  {!step.done ? (
                    <button
                      type="button"
                      className="ws-checklist-jump"
                      onClick={() => onNavigateSection(step.section)}
                    >
                      Fix
                      <ArrowUpRight className="inline h-3 w-3" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {!step.done && step.blocker ? (
                  <p className="mt-0.5 pl-6 text-[0.6875rem] leading-snug text-[var(--text-tertiary)]">
                    {step.blocker}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
