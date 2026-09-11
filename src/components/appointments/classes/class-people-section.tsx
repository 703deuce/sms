"use client";

import { useState } from "react";
import { Boxes, MapPin, Plus, UserRound } from "lucide-react";
import { Field, Modal, Panel, TextInput } from "@/components/appointments/workspace-ui";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import type { ClassEditorOptions } from "@/features/appointments/kimi/classes/use-class-editor";

type Props = {
  form: ClassFormState;
  options: ClassEditorOptions;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
  onAddStaff: (name: string) => Promise<string | null>;
  onAddLocation: (name: string) => Promise<string | null>;
  onAddResource: (name: string, quantity: number) => Promise<string | null>;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const LOCATION_KIND_LABEL: Record<string, string> = {
  office: "In person",
  virtual: "Online",
  phone: "Phone",
  custom: "Custom",
};

export function ClassPeoplePlaceSection({
  form,
  options,
  onFormChange,
  onAddStaff,
  onAddLocation,
  onAddResource,
}: Props) {
  const [staffModal, setStaffModal] = useState(false);
  const [locationModal, setLocationModal] = useState(false);
  const [resourceModal, setResourceModal] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  /**
   * Creating a person or a place from here keeps the class draft intact —
   * that is the entire reason it is not a link out to Settings.
   */
  async function create(kind: "staff" | "location" | "resource") {
    setBusy(true);
    const id =
      kind === "staff"
        ? await onAddStaff(draftName)
        : kind === "location"
          ? await onAddLocation(draftName)
          : await onAddResource(draftName, draftQuantity);
    setBusy(false);
    if (!id) return;
    if (kind === "staff") {
      onFormChange("staffId", id);
      setStaffModal(false);
    } else if (kind === "location") {
      onFormChange("locationId", id);
      setLocationModal(false);
    } else {
      onFormChange("resourceIds", [...form.resourceIds, id]);
      setResourceModal(false);
    }
    setDraftName("");
    setDraftQuantity(1);
  }

  function toggleResource(id: string) {
    onFormChange(
      "resourceIds",
      form.resourceIds.includes(id)
        ? form.resourceIds.filter((r) => r !== id)
        : [...form.resourceIds, id],
    );
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel
          title="Instructor"
          icon={UserRound}
          className="ws-span-6"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => {
                setDraftName("");
                setStaffModal(true);
              }}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add staff
            </button>
          }
        >
          {options.staffOptions.length === 0 ? (
            <div className="ws-empty-inline">
              <span className="ws-empty-inline-icon">
                <UserRound className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No staff yet
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Add the person who teaches this class without leaving the page.
                </p>
              </div>
            </div>
          ) : (
            <div className="ws-people-grid" role="radiogroup" aria-label="Instructor">
              <button
                type="button"
                className="ws-people-card"
                role="radio"
                aria-checked={!form.staffId}
                onClick={() => onFormChange("staffId", "")}
              >
                <span className="ws-people-avatar" aria-hidden>
                  —
                </span>
                <span className="min-w-0">
                  <span className="ws-people-name">Unassigned</span>
                  <span className="ws-people-meta">Decide later</span>
                </span>
              </button>
              {options.staffOptions.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  className="ws-people-card"
                  role="radio"
                  aria-checked={form.staffId === staff.id}
                  onClick={() => onFormChange("staffId", staff.id)}
                >
                  <span className="ws-people-avatar" aria-hidden>
                    {initials(staff.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="ws-people-name">{staff.name}</span>
                    <span className="ws-people-meta">{staff.role || "Staff"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Location"
          icon={MapPin}
          className="ws-span-6"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => {
                setDraftName("");
                setLocationModal(true);
              }}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add location
            </button>
          }
        >
          {options.locationOptions.length === 0 ? (
            <div className="ws-empty-inline">
              <span className="ws-empty-inline-icon">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No locations yet
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Add where this class runs without leaving the page.
                </p>
              </div>
            </div>
          ) : (
            <div className="ws-people-grid" role="radiogroup" aria-label="Location">
              <button
                type="button"
                className="ws-people-card"
                role="radio"
                aria-checked={!form.locationId}
                onClick={() => onFormChange("locationId", "")}
              >
                <span className="ws-people-avatar" aria-hidden>
                  —
                </span>
                <span className="min-w-0">
                  <span className="ws-people-name">Unassigned</span>
                  <span className="ws-people-meta">Decide later</span>
                </span>
              </button>
              {options.locationOptions.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className="ws-people-card"
                  role="radio"
                  aria-checked={form.locationId === location.id}
                  onClick={() => onFormChange("locationId", location.id)}
                >
                  <span className="ws-people-avatar" aria-hidden>
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="ws-people-name">{location.name}</span>
                    <span className="ws-people-meta">
                      {location.address || LOCATION_KIND_LABEL[location.kind || "office"] || "In person"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Rooms & equipment"
          icon={Boxes}
          className="ws-span-12"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => {
                setDraftName("");
                setDraftQuantity(1);
                setResourceModal(true);
              }}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add resource
            </button>
          }
        >
          {options.resourceOptions.length === 0 ? (
            <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
              No rooms or equipment defined yet. Add one to record what this class occupies.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {options.resourceOptions.map((resource) => {
                  const on = form.resourceIds.includes(resource.id);
                  return (
                    <button
                      key={resource.id}
                      type="button"
                      className="ws-resource-chip"
                      aria-pressed={on}
                      onClick={() => toggleResource(resource.id)}
                    >
                      <span className="ws-resource-chip-icon" aria-hidden>
                        <Boxes className="h-3 w-3" />
                      </span>
                      {resource.name}
                      <span className="ws-resource-chip-qty">{resource.quantity}</span>
                    </button>
                  );
                })}
              </div>
              <p className="ws-gap-note mt-3">
                <Boxes className="h-3.5 w-3.5" aria-hidden />
                Resources are recorded against the class for planning. Class registration does not
                yet hold a resource against a session the way appointment booking does, so double
                booking a room is not blocked automatically.
              </p>
            </>
          )}
        </Panel>
      </div>

      {staffModal ? (
        <Modal
          title="Add staff member"
          description="They are added to workspace staff and assigned to this class."
          onClose={() => setStaffModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setStaffModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!draftName.trim() || busy}
                onClick={() => void create("staff")}
              >
                {busy ? "Adding…" : "Add staff"}
              </button>
            </>
          }
        >
          <Field label="Name" htmlFor="cls-new-staff">
            <TextInput
              id="cls-new-staff"
              value={draftName}
              placeholder="Maya Chen"
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {locationModal ? (
        <Modal
          title="Add location"
          description="It is added to workspace locations and assigned to this class."
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
                disabled={!draftName.trim() || busy}
                onClick={() => void create("location")}
              >
                {busy ? "Adding…" : "Add location"}
              </button>
            </>
          }
        >
          <Field label="Name" htmlFor="cls-new-location">
            <TextInput
              id="cls-new-location"
              value={draftName}
              placeholder="Studio B"
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {resourceModal ? (
        <Modal
          title="Add room or equipment"
          description="Resources are shared across the workspace."
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
                disabled={!draftName.trim() || busy}
                onClick={() => void create("resource")}
              >
                {busy ? "Adding…" : "Add resource"}
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="cls-new-resource">
              <TextInput
                id="cls-new-resource"
                value={draftName}
                placeholder="Reformer"
                onChange={(e) => setDraftName(e.target.value)}
              />
            </Field>
            <Field label="Quantity" htmlFor="cls-new-resource-qty">
              <TextInput
                id="cls-new-resource-qty"
                type="number"
                min={1}
                value={draftQuantity}
                onChange={(e) => setDraftQuantity(Number(e.target.value) || 1)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
