"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Info,
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

  return (
    <div className="ws-overview-grid grid has-side">
      <div className="space-y-5">
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
          flush
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
      </div>

      <aside className="space-y-5">
        <div className="ws-preview-card">
          <div className="ws-preview-browser">
            <span className="ws-preview-dot" />
            <span className="ws-preview-dot" />
            <span className="ws-preview-dot" />
            <span className="ml-1.5 truncate text-[0.625rem] text-[var(--text-tertiary)]">
              {bookingLink ? bookingLink.replace(/^https?:\/\//, "") : "Save to publish"}
            </span>
          </div>
          <div className="ws-preview-body">
            <p className="ws-side-card-label">
              <Eye className="h-3 w-3" aria-hidden />
              Customer view
            </p>
            <p className="mt-2 text-[var(--type-section)] font-semibold text-[var(--text-primary)]">
              {form.name || "Untitled service"}
            </p>
            <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
              {formatDurationMinutes(form.durationMinutes)} · {price}
            </p>
            {form.description ? (
              <p className="mt-2 line-clamp-3 text-[var(--type-helper)] text-[var(--text-secondary)]">
                {form.description}
              </p>
            ) : null}
            <p className="mt-3 inline-flex items-center gap-1.5 text-[var(--type-helper)]">
              <span
                className={`ws-chip ${form.enabled && form.visibility === "public" ? "ws-chip-success" : "ws-chip-neutral"}`}
              >
                {form.enabled && form.visibility === "public" ? "Live" : "Not public"}
              </span>
            </p>
            {bookingLink ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="appt-pilot-outline-btn" onClick={onPreview}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Open booking page
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
            ) : (
              <p className="mt-4 flex items-start gap-2 text-[var(--type-helper)] text-[var(--text-secondary)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Save this service to get its booking link.
              </p>
            )}
          </div>
        </div>
      </aside>

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
