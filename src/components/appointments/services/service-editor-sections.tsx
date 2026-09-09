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
import { TypeServicePhasesSection } from "@/components/appointments/kimi-ui/appointment-types/components/TypeServicePhasesSection";
import type { AppointmentTypeFormState as FormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
  SectionCard,
} from "@/components/appointments/meetings/meeting-editor-sections";
import type { ServiceEditorOptions } from "@/features/appointments/kimi/services/use-service-editor";

type SectionProps = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
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
    <Link
      href={href}
      className="appt-pilot-muted-link"
      onClick={() => onPersistDraft?.()}
    >
      {children}
    </Link>
  );
}

export function ServiceGeneralSection({
  form,
  onFormChange,
  categoryOptions,
  onPersistDraft,
}: SectionProps & { categoryOptions: ServiceEditorOptions["categoryOptions"] }) {
  return (
    <SectionCard id="service-general" title="General" description="What is this service?">
      <div>
        <PilotLabel htmlFor="service-name">Service name</PilotLabel>
        <PilotInput
          id="service-name"
          value={form.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          placeholder="Personal training session"
        />
      </div>
      <div>
        <PilotLabel htmlFor="service-description">Description</PilotLabel>
        <PilotTextarea
          id="service-description"
          rows={4}
          maxLength={500}
          value={form.description}
          onChange={(e) => onFormChange("description", e.target.value)}
          placeholder="Describe what customers receive."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel htmlFor="service-category">Category</PilotLabel>
          <PilotSelect
            id="service-category"
            value={form.categoryId}
            onChange={(e) => onFormChange("categoryId", e.target.value)}
          >
            <option value="">No category</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </PilotSelect>
          <p className="mt-2 appt-pilot-text-helper">
            <ContextLink href="/appointments/categories" onPersistDraft={onPersistDraft}>
              Manage categories
            </ContextLink>
          </p>
        </div>
        <div>
          <PilotLabel htmlFor="service-image">Image URL</PilotLabel>
          <PilotInput
            id="service-image"
            type="url"
            placeholder="https://…"
            value={form.imageUrl}
            onChange={(e) => onFormChange("imageUrl", e.target.value)}
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
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => onFormChange("enabled", e.target.checked)}
        />
        Active — customers can book this service
      </label>
    </SectionCard>
  );
}

export function ServiceSchedulingSection({
  form,
  onFormChange,
  namedScheduleOptions,
  serviceId,
  isCreating,
  onPersistDraft,
}: SectionProps & {
  namedScheduleOptions: ServiceEditorOptions["namedScheduleOptions"];
  serviceId: string | null;
  isCreating: boolean;
}) {
  function addDurationOption() {
    const id = `dur_${Date.now()}`;
    onFormChange("durationOptions", [
      ...form.durationOptions,
      { id, label: `${form.durationMinutes + 15} min`, minutes: form.durationMinutes + 15, active: true },
    ]);
  }

  return (
    <SectionCard
      id="service-scheduling"
      title="Scheduling"
      description="How long this service takes and how it fits on your calendar."
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
          <PilotLabel>Buffer after</PilotLabel>
          <div className="flex items-center gap-2">
            <PilotInput
              type="number"
              min={0}
              className="w-24"
              value={form.bufferMinutes}
              onChange={(e) => onFormChange("bufferMinutes", Number(e.target.value) || 0)}
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
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <PilotLabel>Duration options</PilotLabel>
          <button type="button" className="appt-pilot-muted-link flex items-center gap-1" onClick={addDurationOption}>
            <Plus size={14} aria-hidden /> Add option
          </button>
        </div>
        {form.durationOptions.length === 0 ? (
          <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
            Customers book {form.durationMinutes} minutes. Add options to offer multiple lengths.
          </p>
        ) : (
          <div className="space-y-2">
            {form.durationOptions.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <PilotInput
                  className="flex-1"
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...form.durationOptions];
                    next[i] = { ...opt, label: e.target.value };
                    onFormChange("durationOptions", next);
                  }}
                />
                <PilotInput
                  type="number"
                  min={5}
                  className="w-20"
                  value={opt.minutes}
                  onChange={(e) => {
                    const next = [...form.durationOptions];
                    next[i] = { ...opt, minutes: Number(e.target.value) || 5 };
                    onFormChange("durationOptions", next);
                  }}
                />
                <button
                  type="button"
                  className="text-[var(--text-secondary)] hover:text-[var(--state-error)]"
                  onClick={() =>
                    onFormChange("durationOptions", form.durationOptions.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove duration option"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={form.recurringEnabled}
          onChange={(e) => onFormChange("recurringEnabled", e.target.checked)}
        />
        Allow recurring bookings
      </label>

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
          <ContextLink href="/appointments/availability" onPersistDraft={onPersistDraft}>
            Manage availability
          </ContextLink>
          {" · "}
          <ContextLink href="/appointments/availability?create=1" onPersistDraft={onPersistDraft}>
            Create availability schedule
          </ContextLink>
        </p>
      </div>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-3">
        <summary className="cursor-pointer appt-pilot-text-list font-medium text-[var(--text-primary)]">
          Advanced scheduling
        </summary>
        <div className="mt-4 space-y-4">
          <p className="appt-pilot-text-helper">
            Service steps break the appointment into phases. Staff can take other appointments during steps where they are not needed.
          </p>
          <div className="appt-pilot-legacy-embed rounded-xl border border-[var(--border)] bg-white p-4">
            <TypeServicePhasesSection appointmentTypeId={serviceId} isCreating={isCreating} />
          </div>
        </div>
      </details>
    </SectionCard>
  );
}

export function ServiceStaffLocationsSection({
  form,
  onFormChange,
  staffOptions,
  locationOptions,
  resourceOptions,
  onPersistDraft,
}: SectionProps & {
  staffOptions: ServiceEditorOptions["staffOptions"];
  locationOptions: ServiceEditorOptions["locationOptions"];
  resourceOptions: ServiceEditorOptions["resourceOptions"];
}) {
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

  function toggleLocationId(id: string) {
    const current = form.locationIds;
    onFormChange(
      "locationIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function toggleResource(id: string) {
    const current = form.resourceIds;
    onFormChange(
      "resourceIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <SectionCard
      id="service-staff-locations"
      title="Staff, locations & rooms"
      description="Who provides this service, where it happens, and what it requires."
    >
      <div>
        <h3 className="appt-pilot-text-list font-medium mb-2">Staff</h3>
        <div className="grid gap-2 mb-3">
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
            No staff yet.{" "}
            <ContextLink href="/appointments/staff" onPersistDraft={onPersistDraft}>Add staff member</ContextLink>
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
      </div>

      <div>
        <h3 className="appt-pilot-text-list font-medium mb-2">Locations</h3>
        {locationOptions.length === 0 ? (
          <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
            No locations yet.{" "}
            <ContextLink href="/appointments/locations" onPersistDraft={onPersistDraft}>Add location</ContextLink>
          </p>
        ) : (
          <ul className="space-y-2">
            {locationOptions.map((loc) => (
              <li key={loc.id}>
                <label className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.locationIds.includes(loc.id)
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                    : "border-[var(--border)]"
                }`}>
                  <input
                    type="checkbox"
                    checked={form.locationIds.includes(loc.id)}
                    onChange={() => toggleLocationId(loc.id)}
                  />
                  <span className="appt-pilot-text-list">{loc.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="appt-pilot-text-list font-medium mb-2">Rooms & equipment</h3>
        {resourceOptions.length === 0 ? (
          <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
            No rooms or equipment yet.{" "}
            <ContextLink href="/appointments/resources" onPersistDraft={onPersistDraft}>Add room or equipment</ContextLink>
          </p>
        ) : (
          <ul className="space-y-2">
            {resourceOptions.map((resource) => (
              <li key={resource.id}>
                <label className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.resourceIds.includes(resource.id)
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                    : "border-[var(--border)]"
                }`}>
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.resourceIds.includes(resource.id)}
                      onChange={() => toggleResource(resource.id)}
                    />
                    <span className="appt-pilot-text-list">{resource.name}</span>
                  </span>
                  {resource.quantity != null && resource.quantity > 1 ? (
                    <span className="appt-pilot-text-helper">Qty {resource.quantity}</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

export function ServiceCustomerInfoSection({
  form,
  onFormChange,
  intakeFormOptions,
  onPersistDraft,
}: SectionProps & { intakeFormOptions: ServiceEditorOptions["intakeFormOptions"] }) {
  const questions = form.bookingQuestions;
  const activeForms = intakeFormOptions.filter((f) => f.active !== false);

  function updateQuestion(index: number, patch: Partial<typeof questions[number]>) {
    onFormChange("bookingQuestions", questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function toggleIntakeForm(id: string) {
    const current = form.intakeFormIds;
    onFormChange(
      "intakeFormIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <SectionCard
      id="service-customer-info"
      title="Customer information"
      description="What you need from customers when they book."
    >
      <div>
        <h3 className="appt-pilot-text-list font-medium mb-2">Quick booking questions</h3>
        {questions.length === 0 ? (
          <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center">
            Name and email are collected by default.
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
                  <PilotSelect
                    className="w-32"
                    value={q.type}
                    onChange={(e) => updateQuestion(index, { type: e.target.value })}
                  >
                    {QUESTION_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </PilotSelect>
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
          className="appt-pilot-muted-link flex items-center gap-1 mt-2"
          onClick={() => onFormChange("bookingQuestions", [...questions, newBookingQuestion()])}
        >
          <Plus size={14} aria-hidden /> Add question
        </button>
      </div>

      <div>
        <h3 className="appt-pilot-text-list font-medium mb-2">Intake form</h3>
        {activeForms.length === 0 ? (
          <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
            No intake forms yet.{" "}
            <ContextLink href="/appointments/commerce" onPersistDraft={onPersistDraft}>Create intake form</ContextLink>
          </p>
        ) : (
          <ul className="space-y-2">
            {activeForms.map((formRow) => (
              <li key={formRow.id}>
                <label className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.intakeFormIds.includes(formRow.id)
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                    : "border-[var(--border)]"
                }`}>
                  <input
                    type="checkbox"
                    checked={form.intakeFormIds.includes(formRow.id)}
                    onChange={() => toggleIntakeForm(formRow.id)}
                  />
                  <span className="appt-pilot-text-list">{formRow.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

export function ServiceAddOnsSection({
  form,
  onFormChange,
  addOnOptions,
  onPersistDraft,
}: SectionProps & { addOnOptions: ServiceEditorOptions["addOnOptions"] }) {
  function toggleAddOn(id: string) {
    const current = form.addOnIds;
    onFormChange(
      "addOnIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <SectionCard id="service-addons" title="Add-ons" description="Extras customers can add during booking.">
      {addOnOptions.length === 0 ? (
        <p className="appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
          No add-ons yet.{" "}
          <ContextLink href="/appointments/commerce" onPersistDraft={onPersistDraft}>Add add-on</ContextLink>
        </p>
      ) : (
        <ul className="space-y-2">
          {addOnOptions.map((addOn) => (
            <li key={addOn.id}>
              <label className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                form.addOnIds.includes(addOn.id)
                  ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                  : "border-[var(--border)]"
              }`}>
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.addOnIds.includes(addOn.id)}
                    onChange={() => toggleAddOn(addOn.id)}
                  />
                  <span className="appt-pilot-text-list">{addOn.name}</span>
                </span>
                {addOn.priceCents != null && addOn.priceCents > 0 ? (
                  <span className="appt-pilot-text-helper">+${(addOn.priceCents / 100).toFixed(2)}</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 appt-pilot-text-helper">
        <ContextLink href="/appointments/commerce" onPersistDraft={onPersistDraft}>Manage add-ons</ContextLink>
      </p>
    </SectionCard>
  );
}

export function ServicePricingAccessSection({
  form,
  onFormChange,
  connectedPaymentProviders,
  onPersistDraft,
}: SectionProps & {
  connectedPaymentProviders: ServiceEditorOptions["connectedPaymentProviders"];
}) {
  const hasProvider = connectedPaymentProviders.length > 0;

  return (
    <SectionCard id="service-pricing" title="Pricing & access" description="What this costs and who can book it.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel htmlFor="service-price-display">Display price (optional)</PilotLabel>
          <PilotInput
            id="service-price-display"
            value={form.priceDisplay}
            onChange={(e) => onFormChange("priceDisplay", e.target.value)}
            placeholder="$75"
          />
          <label className="mt-2 flex items-center gap-2 appt-pilot-text-helper">
            <input
              type="checkbox"
              checked={form.showPriceOnBooking}
              onChange={(e) => onFormChange("showPriceOnBooking", e.target.checked)}
            />
            Show price on booking page
          </label>
        </div>
      </div>

      <div>
        <PilotLabel>Payment collection</PilotLabel>
        <PilotSelect
          value={form.paymentMode}
          onChange={(e) => onFormChange("paymentMode", e.target.value as FormState["paymentMode"])}
        >
          <option value="none">Free / pay later</option>
          <option value="full">Full payment</option>
          <option value="deposit">Deposit</option>
          <option value="optional">Optional payment</option>
          <option value="pay_what_you_want">Pay what you want</option>
        </PilotSelect>
      </div>
      {form.paymentMode !== "none" && !hasProvider ? (
        <p className="appt-pilot-text-helper rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
          Connect a payment provider to collect payment.{" "}
          <ContextLink href="/settings/business" onPersistDraft={onPersistDraft}>Connect Stripe</ContextLink>
          {" · "}
          <ContextLink href="/settings/business" onPersistDraft={onPersistDraft}>Connect Square</ContextLink>
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

      <details className="rounded-xl border border-[var(--border)] px-4 py-3">
        <summary className="cursor-pointer appt-pilot-text-list font-medium">Packages & memberships</summary>
        <div className="mt-3 space-y-3 appt-pilot-text-helper">
          <p>
            Customers can use packages and member benefits when booking this service. Full package and membership management lives under Packages & Sales.
          </p>
          <p>
            <ContextLink href="/appointments/packages" onPersistDraft={onPersistDraft}>Manage packages</ContextLink>
            {" · "}
            <ContextLink href="/appointments/memberships" onPersistDraft={onPersistDraft}>Manage memberships</ContextLink>
            {" · "}
            <ContextLink href="/appointments/packages/new" onPersistDraft={onPersistDraft}>Create package</ContextLink>
          </p>
          <p className="text-[var(--text-secondary)]">
            Per-service package eligibility assignment is deferred to the Packages focused batch.
          </p>
        </div>
      </details>
    </SectionCard>
  );
}

export function ServicePoliciesSection({
  form,
  onFormChange,
  onPersistDraft,
}: SectionProps) {
  return (
    <SectionCard id="service-policies" title="Policies & documents" description="Rules and agreements for this service.">
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
          {form.cancellationPolicy.allowed === "until_hours_before" ? (
            <div className="mt-2 flex items-center gap-2">
              <PilotInput
                type="number"
                min={1}
                className="w-20"
                value={form.cancellationPolicy.hoursBefore ?? 24}
                onChange={(e) =>
                  onFormChange("cancellationPolicy", {
                    ...form.cancellationPolicy,
                    hoursBefore: Number(e.target.value) || 24,
                  })
                }
              />
              <span className="appt-pilot-text-helper">hours before</span>
            </div>
          ) : null}
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

      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={form.bookingApprovalRequired}
          onChange={(e) => onFormChange("bookingApprovalRequired", e.target.checked)}
        />
        Require approval before confirming
      </label>

      <details className="rounded-xl border border-[var(--border)] px-4 py-3">
        <summary className="cursor-pointer appt-pilot-text-list font-medium">Terms & contract</summary>
        <div className="mt-3 space-y-2 appt-pilot-text-helper">
          <p>
            Assign terms or contract templates customers must accept or sign.{" "}
            <ContextLink href="/appointments/policies" onPersistDraft={onPersistDraft}>Manage policies</ContextLink>
            {" · "}
            <ContextLink href="/appointments/contracts" onPersistDraft={onPersistDraft}>Manage contracts</ContextLink>
          </p>
          <p className="text-[var(--text-secondary)]">
            Per-service terms/contract picker ships with the Contracts focused batch; use transitional policy settings until then.
          </p>
        </div>
      </details>
    </SectionCard>
  );
}

export function ServiceConfirmationSection({
  form,
  onFormChange,
  bookingLink,
}: SectionProps & { bookingLink: string | null }) {
  return (
    <SectionCard id="service-confirmation" title="Confirmation" description="What customers see after booking.">
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
          placeholder="Thanks for booking. We look forward to seeing you."
        />
      </div>
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input
          type="checkbox"
          checked={form.redirectAfterBookingEnabled}
          onChange={(e) => onFormChange("redirectAfterBookingEnabled", e.target.checked)}
        />
        Redirect after booking
      </label>
      {form.redirectAfterBookingEnabled ? (
        <PilotInput
          type="url"
          placeholder="https://…"
          value={form.redirectAfterBookingUrl}
          onChange={(e) => onFormChange("redirectAfterBookingUrl", e.target.value)}
        />
      ) : null}
      {bookingLink ? (
        <p className="appt-pilot-text-helper break-all">
          Booking link: <span className="text-[var(--brand-accent)]">{bookingLink}</span>
        </p>
      ) : null}
    </SectionCard>
  );
}
