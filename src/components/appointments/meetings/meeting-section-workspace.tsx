"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Circle,
  CreditCard,
  Eye,
  MessageSquare,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { MeetingEditorOptions } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import {
  MeetingConfirmationSection,
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
  staffNames,
  onFormChange,
}: Pick<Props, "form" | "staffNames" | "onFormChange">) {
  const host = hostAssignmentLabel(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );
  const method = meetingMethodLabel({ location: form.location });
  const hasName = form.name.trim().length > 0;
  const hasDuration = form.durationMinutes >= 5;
  const hasAvailability = true;
  const hasHost =
    form.staffAssignment === "any_eligible" ||
    form.staffIds.length > 0 ||
    form.collectiveStaffIds.length > 0;
  const hasMethod = Boolean(form.location?.trim());

  const setupSteps = [
    { label: "Basic details", done: hasName },
    { label: "Duration", done: hasDuration },
    { label: "Availability", done: hasAvailability },
    { label: "Host strategy", done: hasHost },
    { label: "Meeting method", done: hasMethod },
  ];

  return (
    <div className="ws-overview-grid has-side">
      <div className="space-y-6">
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
            <div className="sm:col-span-2">
              <PilotLabel htmlFor="ov-desc">Description</PilotLabel>
              <PilotTextarea
                id="ov-desc"
                rows={3}
                value={form.description}
                onChange={(e) => onFormChange("description", e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard id="overview-public" title="Public booking" description="How customers find and book this meeting.">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className={form.enabled ? "ws-badge-active" : "ws-badge-neutral"}>
              {form.enabled ? "Active" : "Inactive"}
            </span>
            <span className="text-[var(--text-secondary)]">|</span>
            <span className="capitalize text-[var(--text-secondary)]">Visibility: {form.visibility}</span>
            <span className="text-[var(--text-secondary)]">|</span>
            <span className="text-[var(--text-secondary)]">Method: <strong className="text-[var(--text-primary)]">{method}</strong></span>
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-secondary)]">
            Save this meeting to generate a shareable public booking link.
          </p>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <div className="ws-side-card">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
            <p className="ws-side-card-label">Customer sees</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">
            {form.name || "Untitled meeting"}
          </p>
          <dl className="mt-3 space-y-2 text-[12px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Duration</dt>
              <dd className="font-medium text-[var(--text-primary)]">{formatDurationMinutes(form.durationMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Host</dt>
              <dd className="font-medium text-[var(--text-primary)]">{host}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Method</dt>
              <dd className="font-medium text-[var(--text-primary)]">{method}</dd>
            </div>
          </dl>
        </div>

        <div className="ws-side-card">
          <p className="ws-side-card-label">Meeting setup</p>
          <ul className="mt-3 space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label} className={`ws-checklist-item${step.done ? " done" : ""}`}>
                {step.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
                {step.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdvancedLanding({
  form,
  onFormChange,
  options,
  bookingLink,
}: Pick<Props, "form" | "onFormChange" | "options" | "bookingLink">) {
  const price = priceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
  });
  const [showPayment, setShowPayment] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  return (
    <div className="space-y-4 max-w-[880px]">
      <div className="space-y-3">
        <button
          type="button"
          className="ws-advanced-landing-card"
          onClick={() => setShowPayment((v) => !v)}
        >
          <div className="ws-advanced-landing-icon">
            <CreditCard className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ws-advanced-row-label">Payment</p>
            <p className="ws-advanced-row-value">{price}</p>
            <span className="ws-advanced-link mt-1 inline-block">Configure</span>
          </div>
        </button>

        <button
          type="button"
          className="ws-advanced-landing-card"
          onClick={() => setShowConfirmation((v) => !v)}
        >
          <div className="ws-advanced-landing-icon">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ws-advanced-row-label">Confirmation</p>
            <p className="ws-advanced-row-value">{form.confirmationHeadline || "Default confirmation"}</p>
            <span className="ws-advanced-link mt-1 inline-block">Configure</span>
          </div>
        </button>

        <div className="ws-advanced-landing-card">
          <div className="ws-advanced-landing-icon">
            <Bell className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ws-advanced-row-label">Reminders</p>
            <p className="ws-advanced-row-value">Workspace reminders</p>
            <Link href="/appointments/automations" className="ws-advanced-link mt-1 inline-block">
              Manage reminders
            </Link>
          </div>
        </div>
      </div>

      {showPayment ? (
        <MeetingPaymentSection
          form={form}
          onFormChange={onFormChange}
          connectedPaymentProviders={options.connectedPaymentProviders}
        />
      ) : null}

      {showConfirmation ? (
        <MeetingConfirmationSection
          form={form}
          onFormChange={onFormChange}
          bookingLink={bookingLink}
        />
      ) : null}
    </div>
  );
}

export function MeetingSectionWorkspace(props: Props) {
  const { section, form, options, onFormChange } = props;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-muted)] px-4 py-5 sm:px-6">
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
      {section === "advanced" ? <AdvancedLanding {...props} /> : null}
    </div>
  );
}
