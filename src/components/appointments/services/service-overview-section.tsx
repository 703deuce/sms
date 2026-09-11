"use client";

import { useState } from "react";
import {
  Check,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  LayoutGrid,
  MapPin,
  Plus,
  Settings2,
  Tag,
  UserRound,
  Wallet,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { ServiceEditorOptions } from "@/features/appointments/kimi/services/use-service-editor";
import {
  Field,
  Modal,
  SectionCard,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import { formatDurationMinutes } from "@/lib/appointments/duration-display";
import {
  serviceLocationSummary,
  servicePriceLabel,
  serviceStaffSummary,
} from "@/lib/appointments/services/service-display";
import type { ServiceSectionId } from "./service-section-types";

type Props = {
  form: AppointmentTypeFormState;
  options: ServiceEditorOptions;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  phaseCount: number;
  bookingLink: string | null;
  copied: boolean;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onNavigateSection: (id: ServiceSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
  onAddCategory: (name: string) => Promise<string | null>;
};

const VISIBILITY_HINT: Record<AppointmentTypeFormState["visibility"], string> = {
  public: "Listed on your booking page and searchable.",
  unlisted: "Only reachable with a direct link.",
  secret: "Hidden — staff booking only.",
};

export function ServiceOverviewSection({
  form,
  options,
  staffNames,
  locationNames,
  phaseCount,
  bookingLink,
  copied,
  onFormChange,
  onNavigateSection,
  onPreview,
  onCopyLink,
  onAddCategory,
}: Props) {
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  const staff = serviceStaffSummary(
    {
      staffAssignment: form.staffAssignment,
      staffIds: form.staffIds,
      collectiveStaffIds: form.collectiveStaffIds,
    },
    staffNames,
  );
  const location = serviceLocationSummary(
    { locationIds: form.locationIds, locationId: form.locationId, location: form.location },
    locationNames,
  );
  const price = servicePriceLabel({
    payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
    priceDisplay: form.priceDisplay,
  });

  const setupRows: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    section: ServiceSectionId;
  }> = [
    {
      icon: Clock,
      label: "Scheduling",
      value:
        phaseCount > 0
          ? `${formatDurationMinutes(form.durationMinutes)} · ${phaseCount} phases`
          : formatDurationMinutes(form.durationMinutes),
      section: "scheduling",
    },
    { icon: UserRound, label: "Staff", value: staff, section: "staff-place" },
    { icon: MapPin, label: "Locations", value: location, section: "staff-place" },
    { icon: Wallet, label: "Pricing", value: price, section: "pricing-access" },
    {
      icon: Eye,
      label: "Customer setup",
      value:
        form.bookingQuestions.length || form.intakeFormIds.length
          ? `${form.bookingQuestions.length} question${form.bookingQuestions.length === 1 ? "" : "s"} · ${form.intakeFormIds.length} form${form.intakeFormIds.length === 1 ? "" : "s"}`
          : "Name and email only",
      section: "customer-setup",
    },
    {
      icon: Settings2,
      label: "Advanced",
      value: form.addOnIds.length ? `${form.addOnIds.length} add-ons` : "Workspace defaults",
      section: "advanced",
    },
  ];

  async function createCategory() {
    setCategorySaving(true);
    const id = await onAddCategory(categoryName);
    setCategorySaving(false);
    if (id) {
      onFormChange("categoryId", id);
      setCategoryName("");
      setCategoryModal(false);
    }
  }

  /** What still stands between this service and a customer being able to book it. */
  const setupSteps: Array<{ label: string; done: boolean }> = [
    { label: "Basic details", done: Boolean(form.name.trim()) },
    { label: "Duration", done: form.durationMinutes >= 5 },
    { label: "Availability", done: Boolean(form.namedScheduleId) || form.enabled },
    {
      label: "Staff",
      done:
        form.staffAssignment === "any_eligible" ||
        (form.staffAssignment === "collective"
          ? form.collectiveStaffIds.length > 0
          : form.staffIds.length > 0),
    },
    { label: "Location", done: form.locationIds.length > 0 || Boolean(form.location) },
  ];

  return (
    <div className="ws-section-col">
      <div className="ws-customer-preview-row">
        <span className="ws-customer-preview-label">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Customer sees
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
          <strong className="font-semibold">{form.name || "Untitled service"}</strong>
          {` · ${formatDurationMinutes(form.durationMinutes)} · ${price} · ${staff} · ${location}`}
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

      <div className="ws-setup-progress" aria-label="Service setup progress">
        <span className="font-medium text-[var(--text-primary)]">Setup</span>
        {setupSteps.map((step) => (
          <span key={step.label} className={step.done ? "done" : undefined}>
            {step.done ? (
              <Check className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <Circle className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {step.label}
            <span className="sr-only">{step.done ? " complete" : " incomplete"}</span>
          </span>
        ))}
      </div>

      <SectionCard
        id="service-details"
        title="Service details"
        description="What customers are booking."
        icon={LayoutGrid}
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="svc-name">
            <TextInput
              id="svc-name"
              value={form.name}
              placeholder="Deep Tissue Massage"
              onChange={(e) => onFormChange("name", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Category"
              htmlFor="svc-category"
              hint={
                <button type="button" className="ws-text-btn" onClick={() => setCategoryModal(true)}>
                  <Plus className="h-3 w-3" aria-hidden />
                  New category
                </button>
              }
            >
              <SelectInput
                id="svc-category"
                value={form.categoryId}
                onChange={(e) => onFormChange("categoryId", e.target.value)}
              >
                <option value="">No category</option>
                {options.categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Image URL" htmlFor="svc-image" hint="Shown on the public booking page.">
              <TextInput
                id="svc-image"
                type="url"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={(e) => onFormChange("imageUrl", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Description"
            htmlFor="svc-description"
            hint={`${form.description.length}/500 characters`}
          >
            <TextArea
              id="svc-description"
              rows={4}
              maxLength={500}
              value={form.description}
              placeholder="Describe what customers receive."
              onChange={(e) => onFormChange("description", e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="service-core"
        title="Core booking details"
        description="The essentials. Everything else lives in its own section."
        icon={Clock}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duration" htmlFor="svc-duration" hint="Minutes a booking occupies.">
            <TextInput
              id="svc-duration"
              type="number"
              min={5}
              step={5}
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 5)}
            />
          </Field>
          <Field
            label="Visibility"
            htmlFor="svc-visibility"
            hint={VISIBILITY_HINT[form.visibility]}
          >
            <SelectInput
              id="svc-visibility"
              value={form.visibility}
              onChange={(e) =>
                onFormChange("visibility", e.target.value as AppointmentTypeFormState["visibility"])
              }
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="secret">Secret</option>
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[var(--type-helper)] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {staff}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" aria-hidden />
            {price}
          </span>
        </div>
      </SectionCard>

      <SectionCard
        id="service-setup-summary"
        title="Setup summary"
        description="Where each part of this service is configured."
        icon={Settings2}
      >
        <div className="ws-summary-rows">
          {setupRows.map((row) => (
            <div key={row.label} className="ws-summary-row">
              <span className="ws-summary-row-icon" aria-hidden>
                <row.icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="ws-summary-row-label block">{row.label}</span>
                <span className="ws-summary-row-value block truncate">{row.value}</span>
              </span>
              <button
                type="button"
                className="ws-text-btn shrink-0"
                onClick={() => onNavigateSection(row.section)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {categoryModal ? (
        <Modal
          title="New category"
          description="Categories group services on your booking page."
          onClose={() => setCategoryModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setCategoryModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!categoryName.trim() || categorySaving}
                onClick={() => void createCategory()}
              >
                {categorySaving ? "Creating…" : "Create category"}
              </button>
            </>
          }
        >
          <Field label="Category name" htmlFor="svc-new-category">
            <TextInput
              id="svc-new-category"
              value={categoryName}
              placeholder="Wellness"
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
