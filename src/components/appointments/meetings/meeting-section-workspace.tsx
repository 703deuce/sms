"use client";

import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { MeetingEditorOptions } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import {
  MeetingConfirmationSection,
  MeetingDetailsSection,
  MeetingDurationSection,
  MeetingHostsSection,
  MeetingMethodSection,
  MeetingPaymentSection,
  MeetingQuestionsSection,
  MeetingRulesSection,
  PilotInput,
  PilotLabel,
  PilotTextarea,
  SectionCard,
} from "./meeting-editor-sections";
import type { MeetingSectionId } from "./meeting-section-types";
import {
  availabilityScheduleLabel,
  formatDurationMinutes,
  hostAssignmentLabel,
  meetingMethodLabel,
  priceLabel,
} from "@/lib/appointments/meetings/meeting-display";

type Props = {
  section: MeetingSectionId;
  form: AppointmentTypeFormState;
  options: MeetingEditorOptions;
  staffNames: Map<string, string>;
  bookingLink: string | null;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onNavigateSection: (id: MeetingSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
  copied: boolean;
};

function OverviewSection({
  form,
  options,
  staffNames,
  bookingLink,
  onFormChange,
  onNavigateSection,
  onPreview,
  onCopyLink,
  copied,
}: Omit<Props, "section">) {
  return (
    <div className="space-y-6 max-w-[880px]">
      <SectionCard id="overview-details" title="Meeting details" description="Name and description customers see.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PilotLabel htmlFor="ov-name">Name</PilotLabel>
            <PilotInput
              id="ov-name"
              value={form.name}
              onChange={(e) => onFormChange("name", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <PilotLabel htmlFor="ov-desc">Description</PilotLabel>
            <PilotTextarea
              id="ov-desc"
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange("description", e.target.value)}
            />
          </div>
          <div>
            <PilotLabel htmlFor="ov-duration">Duration (minutes)</PilotLabel>
            <PilotInput
              id="ov-duration"
              type="number"
              min={5}
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 30)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard id="overview-public" title="Public booking" description="How customers find and book this meeting.">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
              form.enabled
                ? "bg-[var(--state-success-soft)] text-[var(--state-success)]"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
            }`}
          >
            {form.enabled ? "Active" : "Inactive"}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] capitalize">
            Visibility: {form.visibility}
          </span>
        </div>
        {bookingLink ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="appt-pilot-outline-btn" onClick={onPreview}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open booking page
            </button>
            <button type="button" className="appt-pilot-outline-btn" onClick={onCopyLink}>
              <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">Save the meeting to generate a public link.</p>
        )}
        <p className="mt-3 text-[13px] text-[var(--text-primary)]">
          Method: <strong>{meetingMethodLabel({ location: form.location })}</strong>
        </p>
      </SectionCard>

      <SectionCard id="overview-setup" title="Setup summary" description="Jump to any section to finish configuration.">
        <dl className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {[
            {
              label: "Availability",
              value: availabilityScheduleLabel(form.namedScheduleId, options.namedScheduleOptions),
              section: "availability" as MeetingSectionId,
            },
            {
              label: "Host",
              value: hostAssignmentLabel(
                {
                  staffAssignment: form.staffAssignment,
                  staffIds: form.staffIds,
                  collectiveStaffIds: form.collectiveStaffIds,
                },
                staffNames,
              ),
              section: "hosts-method" as MeetingSectionId,
            },
            {
              label: "Meeting method",
              value: meetingMethodLabel({ location: form.location }),
              section: "hosts-method" as MeetingSectionId,
            },
            {
              label: "Questions",
              value: String(form.bookingQuestions.length),
              section: "questions" as MeetingSectionId,
            },
            {
              label: "Booking rules",
              value: form.bookingApprovalRequired ? "Approval required" : "Workspace defaults",
              section: "booking-rules" as MeetingSectionId,
            },
            {
              label: "Price",
              value: priceLabel({
                payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
              }),
              section: "advanced" as MeetingSectionId,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <dt className="text-[11px] font-medium text-[var(--text-secondary)]">{row.label}</dt>
                <dd className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{row.value}</dd>
              </div>
              <button
                type="button"
                className="shrink-0 text-[12px] font-semibold text-[var(--brand-accent)] hover:underline"
                onClick={() => onNavigateSection(row.section)}
              >
                Edit
              </button>
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  );
}

function AdvancedLanding({
  form,
  onFormChange,
  options,
  bookingLink,
  onNavigateSection,
}: Pick<Props, "form" | "onFormChange" | "options" | "bookingLink" | "onNavigateSection">) {
  const price = priceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
  });

  return (
    <div className="space-y-4 max-w-[880px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--brand-accent)]/30"
          onClick={() => onNavigateSection("advanced")}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Payment</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">{price}</p>
          <span className="mt-2 inline-block text-[12px] font-semibold text-[var(--brand-accent)]">Configure</span>
        </button>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Confirmation</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
            {form.confirmationHeadline || "Default confirmation"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Reminders</p>
          <p className="mt-1 text-[13px] text-[var(--text-primary)]">Use workspace reminder automations.</p>
          <Link href="/appointments/automations" className="mt-2 inline-block text-[12px] font-semibold text-[var(--brand-accent)] hover:underline">
            Manage reminders
          </Link>
        </div>
      </div>
      <MeetingPaymentSection
        form={form}
        onFormChange={onFormChange}
        connectedPaymentProviders={options.connectedPaymentProviders}
      />
      <MeetingConfirmationSection
        form={form}
        onFormChange={onFormChange}
        bookingLink={bookingLink}
      />
    </div>
  );
}

export function MeetingSectionWorkspace(props: Props) {
  const { section, form, options, onFormChange } = props;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      {section === "overview" ? <OverviewSection {...props} /> : null}
      {section === "availability" ? (
        <div className="max-w-[880px]">
          <MeetingDurationSection
            form={form}
            onFormChange={onFormChange}
            namedScheduleOptions={options.namedScheduleOptions}
          />
        </div>
      ) : null}
      {section === "hosts-method" ? (
        <div className="max-w-[880px] space-y-6">
          <MeetingHostsSection
            form={form}
            onFormChange={onFormChange}
            staffOptions={options.staffOptions}
          />
          <MeetingMethodSection form={form} onFormChange={onFormChange} />
        </div>
      ) : null}
      {section === "questions" ? (
        <div className="max-w-[880px]">
          <MeetingQuestionsSection form={form} onFormChange={onFormChange} />
        </div>
      ) : null}
      {section === "booking-rules" ? (
        <div className="max-w-[880px]">
          <MeetingRulesSection form={form} onFormChange={onFormChange} />
        </div>
      ) : null}
      {section === "advanced" ? (
        <AdvancedLanding {...props} />
      ) : null}
    </div>
  );
}
