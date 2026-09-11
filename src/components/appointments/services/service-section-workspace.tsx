"use client";

import Link from "next/link";
import {
  Calendar,
  Check,
  Circle,
  ClipboardList,
  CreditCard,
  Users,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { ServiceEditorOptions } from "@/features/appointments/kimi/services/use-service-editor";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
} from "@/components/appointments/meetings/meeting-editor-sections";
import {
  ServiceCustomerInfoSection,
  ServicePricingAccessSection,
  ServiceSchedulingSection,
  ServiceStaffLocationsSection,
} from "./service-editor-sections";
import type { ServiceSectionId } from "./service-section-types";
import {
  serviceDurationSummary,
  servicePriceLabel,
  serviceStaffSummary,
  serviceLocationSummary,
} from "@/lib/appointments/services/service-display";

type Props = {
  section: ServiceSectionId;
  form: AppointmentTypeFormState;
  options: ServiceEditorOptions;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  serviceId: string | null;
  isCreating: boolean;
  bookingLink: string | null;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onNavigateSection: (id: ServiceSectionId) => void;
  onPersistDraft: () => void;
};

function formatDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}

function CustomerPreviewBar({
  form,
  staffNames,
  locationNames,
}: Pick<Props, "form" | "staffNames" | "locationNames">) {
  const configView = {
    staffAssignment: form.staffAssignment,
    staffIds: form.staffIds,
    collectiveStaffIds: form.collectiveStaffIds,
    locationIds: form.locationIds,
    locationId: form.locationId,
    location: form.location,
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
    priceDisplay: form.priceDisplay,
  };

  const name = form.name || "Untitled service";
  const duration = formatDuration(form.durationMinutes);
  const price = servicePriceLabel(configView);
  const staff = serviceStaffSummary(configView, staffNames);

  return (
    <div className="ws-customer-preview">
      Customer sees <strong className="text-[var(--text-primary)]">{name}</strong>
      {" · "}
      {duration} · {price} · {staff}
      <span className="text-[var(--text-tertiary)]"> — Save for link</span>
    </div>
  );
}

function SetupProgress({ form }: { form: AppointmentTypeFormState }) {
  const hasName = form.name.trim().length > 0;
  const hasDuration = form.durationMinutes >= 5;
  const hasAvailability = true;
  const hasStaff =
    form.staffAssignment === "any_eligible" ||
    form.staffIds.length > 0 ||
    form.collectiveStaffIds.length > 0;
  const hasLocation = form.locationIds.length > 0 || Boolean(form.location?.trim());

  const steps = [
    { label: "Basic details", done: hasName },
    { label: "Duration", done: hasDuration },
    { label: "Availability", done: hasAvailability },
    { label: "Staff", done: hasStaff },
    { label: "Location", done: hasLocation },
  ];

  return (
    <div className="ws-setup-progress" aria-label="Setup progress">
      <span className="font-medium text-[var(--text-secondary)]">Setup</span>
      {steps.map((step) => (
        <span key={step.label} className={step.done ? "done inline-flex items-center gap-1" : "inline-flex items-center gap-1"}>
          {step.done ? <Check className="h-3 w-3" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
          {step.label}
        </span>
      ))}
    </div>
  );
}

function OverviewSection(props: Props) {
  const { form, options, staffNames, locationNames, onFormChange, onNavigateSection, onPersistDraft } = props;

  const configView = {
    staffAssignment: form.staffAssignment,
    staffIds: form.staffIds,
    collectiveStaffIds: form.collectiveStaffIds,
    locationIds: form.locationIds,
    locationId: form.locationId,
    location: form.location,
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
    priceDisplay: form.priceDisplay,
    durationOptions: form.durationOptions,
    durationMinutes: form.durationMinutes,
  };

  const duration =
    form.durationOptions.length > 1
      ? serviceDurationSummary({ durationMinutes: form.durationMinutes, config: configView } as never)
      : formatDuration(form.durationMinutes);

  const summaryRows = [
    {
      icon: Calendar,
      label: "Scheduling",
      value: duration,
      section: "scheduling" as ServiceSectionId,
    },
    {
      icon: Users,
      label: "Staff & place",
      value: `${serviceStaffSummary(configView, staffNames)} — ${serviceLocationSummary(configView, locationNames)}`,
      section: "staff-place" as ServiceSectionId,
    },
    {
      icon: CreditCard,
      label: "Pricing & access",
      value: servicePriceLabel(configView),
      section: "pricing-access" as ServiceSectionId,
    },
    {
      icon: ClipboardList,
      label: "Customer setup",
      value: form.bookingQuestions.length > 0 || form.intakeFormIds.length > 0
        ? `${form.bookingQuestions.length} question${form.bookingQuestions.length === 1 ? "" : "s"}`
        : "Default fields",
      section: "customer-setup" as ServiceSectionId,
    },
  ];

  return (
    <div className="space-y-6 max-w-[880px]">
      <SetupProgress form={form} />

      <div className="ws-flat-section">
        <h3>Service details</h3>
        <div className="mt-4 space-y-4">
          <div>
            <PilotLabel htmlFor="ov-service-name">Name</PilotLabel>
            <PilotInput
              id="ov-service-name"
              value={form.name}
              onChange={(e) => onFormChange("name", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <PilotLabel htmlFor="ov-service-category">Category</PilotLabel>
              <PilotSelect
                id="ov-service-category"
                value={form.categoryId}
                onChange={(e) => onFormChange("categoryId", e.target.value)}
              >
                <option value="">No category</option>
                {options.categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </PilotSelect>
            </div>
            <div>
              <PilotLabel htmlFor="ov-service-duration">Duration</PilotLabel>
              <div className="flex items-center gap-2">
                <PilotInput
                  id="ov-service-duration"
                  type="number"
                  min={5}
                  className="w-24"
                  value={form.durationMinutes}
                  onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 30)}
                />
                <span className="text-[12px] text-[var(--text-secondary)]">min</span>
              </div>
            </div>
          </div>
          <div>
            <PilotLabel htmlFor="ov-service-desc">Description</PilotLabel>
            <PilotTextarea
              id="ov-service-desc"
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange("description", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ws-flat-section">
        <h3>Core booking</h3>
        <div className="ws-core-booking mt-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className={form.enabled ? "ws-badge-active" : "ws-badge-neutral"}>
              {form.enabled ? "Active" : "Inactive"}
            </span>
            <span className="text-[var(--text-secondary)]">|</span>
            <span className="capitalize text-[var(--text-secondary)]">{form.visibility}</span>
            <span className="text-[var(--text-secondary)]">|</span>
            <span className="font-medium text-[var(--text-primary)]">{duration}</span>
          </div>
          <button type="button" className="ws-advanced-link" onClick={onPersistDraft}>
            Save to get booking link
          </button>
        </div>
      </div>

      <div className="ws-flat-section">
        <h3>Setup summary</h3>
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
          {summaryRows.map((row) => (
            <div key={row.label} className="ws-setup-summary-row">
              <div className="min-w-0">
                <div className="ws-setup-summary-label">
                  <row.icon className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
                  {row.label}
                </div>
                <p className="ws-setup-summary-value mt-0.5 truncate pl-6">{row.value}</p>
              </div>
              <button
                type="button"
                className="ws-advanced-link shrink-0"
                onClick={() => onNavigateSection(row.section)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvancedSection({
  form,
  onNavigateSection,
}: Pick<Props, "form" | "onNavigateSection">) {
  const rows = [
    {
      label: "Add-ons",
      value: `${form.addOnIds.length} active`,
      action: "Manage",
      onClick: () => onNavigateSection("advanced"),
    },
    {
      label: "Policies",
      value: "Workspace default",
      action: "Manage",
      onClick: () => onNavigateSection("advanced"),
    },
    {
      label: "Confirmation",
      value: form.confirmationHeadline || "Default confirmation",
      action: "Configure",
      onClick: () => onNavigateSection("advanced"),
    },
    {
      label: "Reminders",
      value: "Workspace reminders",
      action: "Manage reminders",
      href: "/appointments/automations",
    },
  ];

  return (
    <div className="max-w-[880px]">
      <div className="ws-flat-section">
        <h3>Advanced</h3>
        <p className="ws-flat-desc">Add-ons, policies, confirmation, and reminders.</p>
      </div>
      <div className="mt-2">
        {rows.map((row) => (
          <div key={row.label} className="ws-advanced-row">
            <div>
              <p className="ws-advanced-row-label">{row.label}</p>
              <p className="ws-advanced-row-value">{row.value}</p>
            </div>
            {row.href ? (
              <Link href={row.href} className="ws-advanced-link">{row.action}</Link>
            ) : (
              <button type="button" className="ws-advanced-link" onClick={row.onClick}>
                {row.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceSectionWorkspace(props: Props) {
  const {
    section,
    form,
    options,
    staffNames,
    locationNames,
    serviceId,
    isCreating,
    onFormChange,
    onNavigateSection,
    onPersistDraft,
  } = props;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-muted)]">
      {section === "overview" ? <CustomerPreviewBar {...props} /> : null}

      <div className="px-4 py-5 sm:px-6">
        {section === "overview" ? <OverviewSection {...props} /> : null}

        {section === "scheduling" ? (
          <div className="max-w-[880px]">
            <ServiceSchedulingSection
              form={form}
              onFormChange={onFormChange}
              namedScheduleOptions={options.namedScheduleOptions}
              serviceId={serviceId}
              isCreating={isCreating}
              onPersistDraft={onPersistDraft}
            />
          </div>
        ) : null}

        {section === "staff-place" ? (
          <div className="max-w-[880px]">
            <ServiceStaffLocationsSection
              form={form}
              onFormChange={onFormChange}
              staffOptions={options.staffOptions}
              locationOptions={options.locationOptions}
              resourceOptions={options.resourceOptions}
              onPersistDraft={onPersistDraft}
            />
          </div>
        ) : null}

        {section === "pricing-access" ? (
          <div className="max-w-[880px]">
            <ServicePricingAccessSection
              form={form}
              onFormChange={onFormChange}
              connectedPaymentProviders={options.connectedPaymentProviders}
              onPersistDraft={onPersistDraft}
            />
          </div>
        ) : null}

        {section === "customer-setup" ? (
          <div className="max-w-[880px]">
            <ServiceCustomerInfoSection
              form={form}
              onFormChange={onFormChange}
              intakeFormOptions={options.intakeFormOptions}
              onPersistDraft={onPersistDraft}
            />
          </div>
        ) : null}

        {section === "advanced" ? (
          <AdvancedSection form={form} onNavigateSection={onNavigateSection} />
        ) : null}
      </div>
    </div>
  );
}
