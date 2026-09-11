"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Car,
  Check,
  MapPin,
  Package,
  Phone,
  Plus,
  Repeat,
  Store,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  Video,
  Wrench,
} from "lucide-react";
import type { StaffAssignmentMode } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type {
  LocationOption,
  ResourceOption,
  StaffOption,
} from "@/features/appointments/kimi/services/use-service-editor";
import {
  ChoiceCard,
  Field,
  Modal,
  NumberField,
  SectionCard,
  TextInput,
} from "@/components/appointments/workspace-ui";

type Props = {
  form: AppointmentTypeFormState;
  staffOptions: StaffOption[];
  locationOptions: LocationOption[];
  resourceOptions: ResourceOption[];
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onAddStaff: (name: string) => Promise<string | null>;
  onAddLocation: (name: string) => Promise<string | null>;
  onAddResource: (name: string, quantity: number) => Promise<string | null>;
};

const STRATEGIES: Array<{
  value: StaffAssignmentMode;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  pool: "none" | "staffIds" | "collectiveStaffIds";
}> = [
  {
    value: "any_eligible",
    label: "Any available",
    helper: "Whoever is free takes the appointment.",
    icon: Users,
    pool: "none",
  },
  {
    value: "specific_staff",
    label: "Specific staff",
    helper: "Only the people you assign can be booked.",
    icon: UserCheck,
    pool: "staffIds",
  },
  {
    value: "customer_chooses",
    label: "Customer chooses",
    helper: "The customer picks their provider when booking.",
    icon: UsersRound,
    pool: "staffIds",
  },
  {
    value: "round_robin",
    label: "Round robin",
    helper: "Rotates evenly through the assigned staff.",
    icon: Repeat,
    pool: "staffIds",
  },
  {
    value: "priority",
    label: "Priority",
    helper: "Assigns the first eligible staff member in priority order.",
    icon: UserRound,
    pool: "staffIds",
  },
];

const LOCATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  office: Building2,
  store: Store,
  branch: Building2,
  customer: Car,
  phone: Phone,
  video: Video,
  transovo_video: Video,
  custom: MapPin,
};

const LOCATION_KIND_LABELS: Record<string, string> = {
  office: "In person",
  store: "In person",
  branch: "In person",
  customer: "At the customer",
  phone: "Phone",
  video: "Video",
  transovo_video: "Video",
  custom: "Custom",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function ServiceStaffPlaceSection({
  form,
  staffOptions,
  locationOptions,
  resourceOptions,
  onFormChange,
  onAddStaff,
  onAddLocation,
  onAddResource,
}: Props) {
  const [staffModal, setStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [locationModal, setLocationModal] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [resourceModal, setResourceModal] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [resourceQty, setResourceQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const strategy = STRATEGIES.find((s) => s.value === form.staffAssignment) || STRATEGIES[0];
  const poolKey = strategy.pool === "none" ? null : strategy.pool;
  const selectedStaff = poolKey ? form[poolKey] : [];

  function toggleStaff(id: string) {
    if (!poolKey) return;
    const current = form[poolKey];
    onFormChange(
      poolKey,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function setPrimaryStaff(id: string) {
    if (!poolKey) return;
    const rest = form[poolKey].filter((x) => x !== id);
    onFormChange(poolKey, [id, ...rest]);
  }

  function toggleLocation(id: string) {
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

  async function createStaff() {
    setBusy(true);
    const id = await onAddStaff(staffName);
    setBusy(false);
    if (!id) return;
    if (poolKey) onFormChange(poolKey, [...form[poolKey], id]);
    setStaffName("");
    setStaffModal(false);
  }

  async function createLocation() {
    setBusy(true);
    const id = await onAddLocation(locationName);
    setBusy(false);
    if (!id) return;
    onFormChange("locationIds", [...form.locationIds, id]);
    setLocationName("");
    setLocationModal(false);
  }

  async function createResource() {
    setBusy(true);
    const id = await onAddResource(resourceName, resourceQty);
    setBusy(false);
    if (!id) return;
    onFormChange("resourceIds", [...form.resourceIds, id]);
    setResourceName("");
    setResourceQty(1);
    setResourceModal(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="ws-section-heading">Staff &amp; place</h2>
        <p className="ws-section-sub">Who provides this service, where it happens, and what it needs.</p>
      </div>

      <SectionCard
        id="service-staff"
        title="Staff"
        description="Assignment decides which providers a customer can be matched with."
        icon={Users}
      >
        <div className="ws-choice-grid">
          {STRATEGIES.map((s) => (
            <ChoiceCard
              key={s.value}
              selected={form.staffAssignment === s.value}
              icon={s.icon}
              name={s.label}
              helper={s.helper}
              onSelect={() => onFormChange("staffAssignment", s.value)}
            />
          ))}
        </div>

        {staffOptions.length === 0 ? (
          <div className="ws-nudge mt-4">
            <span className="ws-nudge-icon" aria-hidden>
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                No staff yet
              </p>
              <p className="ws-field-hint">
                A service needs at least one provider before it can be booked. Add one here without
                losing your changes, or manage the roster in{" "}
                <Link href="/appointments/staff" className="appt-pilot-muted-link">
                  Staff
                </Link>
                .
              </p>
              <button
                type="button"
                className="appt-pilot-primary-btn mt-3"
                onClick={() => setStaffModal(true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add staff member
              </button>
            </div>
          </div>
        ) : poolKey ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                Assigned staff
              </p>
              <button type="button" className="ws-text-btn" onClick={() => setStaffModal(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add staff
              </button>
            </div>
            <p className="ws-field-hint">
              {selectedStaff.length > 0
                ? `${selectedStaff.length} of ${staffOptions.length} assigned. The first is the default provider.`
                : "Assign at least one provider so this service can be booked."}
            </p>
            <ul className="ws-person-grid mt-3">
              {staffOptions.map((s) => {
                const on = selectedStaff.includes(s.id);
                const primary = on && selectedStaff[0] === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="ws-person-card"
                      aria-pressed={on}
                      onClick={() => toggleStaff(s.id)}
                    >
                      <span className="ws-person-avatar" aria-hidden>
                        {initials(s.name)}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="ws-person-name block truncate">{s.name}</span>
                        <span className="ws-person-meta block truncate">
                          {s.role || "Provider"}
                          {s.customerSelectable === false ? " · Not customer selectable" : ""}
                        </span>
                      </span>
                      {on ? (
                        <span className="ws-person-check" aria-hidden>
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </button>
                    {on && selectedStaff.length > 1 ? (
                      primary ? (
                        <span className="ws-chip ws-chip-accent mt-1.5">Default provider</span>
                      ) : (
                        <button
                          type="button"
                          className="ws-text-btn mt-1.5"
                          onClick={() => setPrimaryStaff(s.id)}
                        >
                          Make default
                        </button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {selectedStaff.length === 0 ? (
              <p className="ws-inline-error mt-3">
                {strategy.label} needs at least one assigned staff member.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="ws-field-hint mt-4">
            Every active staff member in your workspace ({staffOptions.length}) can provide this
            service.
          </p>
        )}
      </SectionCard>

      <SectionCard
        id="service-locations"
        title="Locations"
        description="Where customers can book this service."
        icon={MapPin}
        action={
          locationOptions.length > 0 ? (
            <button type="button" className="ws-text-btn" onClick={() => setLocationModal(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add location
            </button>
          ) : null
        }
      >
        {locationOptions.length === 0 ? (
          <div className="ws-nudge">
            <span className="ws-nudge-icon" aria-hidden>
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                No locations yet
              </p>
              <p className="ws-field-hint">
                Add where this service happens — a room, a shop, the customer&rsquo;s address, or a
                video call.
              </p>
              <button
                type="button"
                className="appt-pilot-primary-btn mt-3"
                onClick={() => setLocationModal(true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add location
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="ws-person-grid">
              {locationOptions.map((l) => {
                const Icon = LOCATION_ICONS[l.kind || "custom"] || MapPin;
                const on = form.locationIds.includes(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="ws-person-card"
                      aria-pressed={on}
                      onClick={() => toggleLocation(l.id)}
                    >
                      <span className="ws-place-icon" aria-hidden>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="ws-person-name block truncate">{l.name}</span>
                        <span className="ws-person-meta block truncate">
                          {l.address || LOCATION_KIND_LABELS[l.kind || "custom"] || "Custom"}
                        </span>
                      </span>
                      {on ? (
                        <span className="ws-person-check" aria-hidden>
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {form.locationIds.length === 0 ? (
              <p className="ws-field-hint mt-3">
                No location selected — customers see the workspace default.
              </p>
            ) : null}
          </>
        )}
      </SectionCard>

      <SectionCard
        id="service-resources"
        title="Rooms & equipment"
        description="Required resources limit availability to when they are free."
        icon={Wrench}
        action={
          resourceOptions.length > 0 ? (
            <button type="button" className="ws-text-btn" onClick={() => setResourceModal(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add resource
            </button>
          ) : null
        }
      >
        {resourceOptions.length === 0 ? (
          <div className="ws-nudge">
            <span className="ws-nudge-icon" aria-hidden>
              <Package className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                No rooms or equipment yet
              </p>
              <p className="ws-field-hint">
                Add a treatment room, chair or machine and this service will only be offered when it
                is free.
              </p>
              <button
                type="button"
                className="appt-pilot-primary-btn mt-3"
                onClick={() => setResourceModal(true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add resource
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {resourceOptions.map((r) => {
                const on = form.resourceIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="ws-resource-chip"
                    aria-pressed={on}
                    onClick={() => toggleResource(r.id)}
                  >
                    <span className="ws-resource-chip-icon" aria-hidden>
                      {on ? <Check className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{r.name}</span>
                    <span className="ws-resource-chip-qty">
                      {r.quantity} available
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="ws-field-hint mt-3">
              {form.resourceIds.length === 0
                ? "No resource required — availability is not constrained by equipment."
                : `${form.resourceIds.length} required. One unit of each is held for every booking.`}
            </p>
          </>
        )}
      </SectionCard>

      {staffModal ? (
        <Modal
          title="Add staff member"
          description="Created in your workspace roster and assigned to this service."
          onClose={() => setStaffModal(false)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setStaffModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!staffName.trim() || busy}
                onClick={() => void createStaff()}
              >
                {busy ? "Adding…" : "Add staff member"}
              </button>
            </>
          }
        >
          <Field label="Name" htmlFor="svc-new-staff">
            <TextInput
              id="svc-new-staff"
              value={staffName}
              placeholder="Jordan Blake"
              onChange={(e) => setStaffName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {locationModal ? (
        <Modal
          title="Add location"
          description="Added to your workspace locations and selected for this service."
          onClose={() => setLocationModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setLocationModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!locationName.trim() || busy}
                onClick={() => void createLocation()}
              >
                {busy ? "Adding…" : "Add location"}
              </button>
            </>
          }
        >
          <Field label="Location name" htmlFor="svc-new-location">
            <TextInput
              id="svc-new-location"
              value={locationName}
              placeholder="Downtown studio"
              onChange={(e) => setLocationName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {resourceModal ? (
        <Modal
          title="Add resource"
          description="Rooms and equipment are shared across services."
          onClose={() => setResourceModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setResourceModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!resourceName.trim() || busy}
                onClick={() => void createResource()}
              >
                {busy ? "Adding…" : "Add resource"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Resource name" htmlFor="svc-new-resource">
              <TextInput
                id="svc-new-resource"
                value={resourceName}
                placeholder="Treatment room 1"
                onChange={(e) => setResourceName(e.target.value)}
              />
            </Field>
            <Field
              label="How many exist"
              htmlFor="svc-new-resource-qty"
              hint="Bookings can overlap up to this count."
            >
              <NumberField
                id="svc-new-resource-qty"
                suffix="units"
                min={1}
                value={resourceQty}
                onChange={(e) => setResourceQty(Number(e.target.value) || 1)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
