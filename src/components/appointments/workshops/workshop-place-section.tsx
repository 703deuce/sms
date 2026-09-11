"use client";

import { useState } from "react";
import { Boxes, Link2, MapPin, Plus, UserRound, Video } from "lucide-react";
import {
  Field,
  Modal,
  NumberField,
  Panel,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import type { WorkshopEditorOptions } from "@/features/appointments/kimi/workshops/use-workshop-editor";

type Props = {
  form: WorkshopFormState;
  options: WorkshopEditorOptions;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
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

const LOCATION_MODES: Array<{
  id: WorkshopFormState["locationMode"];
  label: string;
  help: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "in_person", label: "In person", help: "A saved business location", icon: MapPin },
  { id: "virtual", label: "Virtual", help: "An online workshop", icon: Video },
  { id: "custom", label: "Custom", help: "A one-off venue or instructions", icon: Link2 },
];

export function WorkshopPlaceSection({
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
   * Creating a person or a place from here keeps the workshop draft intact —
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
          title="Location"
          icon={MapPin}
          className="ws-span-6"
          actions={
            form.locationMode === "in_person" ? (
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
            ) : null
          }
        >
          <div
            className="ws-choice-grid is-triple is-tight"
            role="radiogroup"
            aria-label="Location type"
          >
            {LOCATION_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={form.locationMode === mode.id}
                className={`ws-choice-card${form.locationMode === mode.id ? " selected" : ""}`}
                onClick={() => onFormChange("locationMode", mode.id)}
              >
                <span className="ws-choice-icon" aria-hidden>
                  <mode.icon className="h-4 w-4" />
                </span>
                <span className="ws-choice-name">{mode.label}</span>
                <span className="ws-choice-help">{mode.help}</span>
              </button>
            ))}
          </div>

          {form.locationMode === "in_person" ? (
            options.locationOptions.length === 0 ? (
              <div className="ws-empty-inline mt-3.5">
                <span className="ws-empty-inline-icon">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                    No locations yet
                  </p>
                  <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                    Add where this workshop happens without leaving the page.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="ws-people-grid mt-3.5"
                role="radiogroup"
                aria-label="Workshop location"
              >
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
                {options.locationOptions.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    className="ws-people-card"
                    role="radio"
                    aria-checked={form.locationId === loc.id}
                    onClick={() => onFormChange("locationId", loc.id)}
                  >
                    <span className="ws-people-avatar" aria-hidden>
                      <MapPin className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="ws-people-name">{loc.name}</span>
                      <span className="ws-people-meta">{loc.address || "No address saved"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : form.locationMode === "virtual" ? (
            <div className="mt-3.5">
              <Field
                label="Joining link"
                htmlFor="wks-virtual-url"
                hint="Shown to registrants on the confirmation."
              >
                <TextInput
                  id="wks-virtual-url"
                  type="url"
                  placeholder="https://meet.example.com/seo-masterclass"
                  value={form.virtualUrl}
                  onChange={(e) => onFormChange("virtualUrl", e.target.value)}
                />
              </Field>
              <p className="ws-gap-note mt-2.5">
                <Video className="h-3.5 w-3.5" aria-hidden />
                <span>
                  The registration page shows the workshop as “Online” and hands the link over
                  once somebody has registered, so it is not public. Nothing creates the meeting
                  for you — paste a link from your own video tool.
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-3.5">
              <Field
                label="Where to go"
                htmlFor="wks-location-note"
                hint="A one-off venue, a room number, or how to find it."
              >
                <TextArea
                  id="wks-location-note"
                  rows={3}
                  maxLength={280}
                  placeholder="Riverside Community Hall, upstairs studio. Enter via the side door."
                  value={form.locationNote}
                  onChange={(e) => onFormChange("locationNote", e.target.value)}
                />
              </Field>
            </div>
          )}
        </Panel>

        <Panel
          title="Host"
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
              Add host
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
                  No host
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Choose who runs this workshop.
                </p>
              </div>
            </div>
          ) : (
            <div className="ws-people-grid" role="radiogroup" aria-label="Workshop host">
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
                    <span className="ws-people-meta">{staff.role || "Workshop host"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="ws-field-hint mt-3">
            The host is shown on the registration page. One host per workshop.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Rooms & equipment"
          icon={Boxes}
          className="ws-span-12"
          flush
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
            <div className="ws-empty-inline" style={{ margin: "0.875rem" }}>
              <span className="ws-empty-inline-icon">
                <Boxes className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No resources yet
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Record the room, projector or kit this workshop needs.
                </p>
              </div>
            </div>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.resourceOptions.map((res) => {
                const selected = form.resourceIds.includes(res.id);
                return (
                  <button
                    key={res.id}
                    type="button"
                    className="ws-row-item is-selectable"
                    aria-pressed={selected}
                    onClick={() => toggleResource(res.id)}
                  >
                    <span className="ws-summary-row-icon" aria-hidden>
                      <Boxes className="h-3.5 w-3.5" />
                    </span>
                    <span className="ws-row-main">
                      <span className="ws-row-primary">{res.name}</span>
                      <span className="ws-row-secondary">
                        <span>
                          {selected ? "Required" : "Not required"} · {res.quantity} available
                        </span>
                      </span>
                    </span>
                    <span className="ws-row-actions">
                      <span className={`ws-chip ${selected ? "ws-chip-accent" : "ws-chip-neutral"}`}>
                        {selected ? "Selected" : "Select"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="ws-gap-note" style={{ margin: "0.875rem" }}>
            <Boxes className="h-3.5 w-3.5" aria-hidden />
            <span>
              Resources are recorded against the workshop for planning. They do not hold a room, so
              two workshops can still be booked into the same space.
            </span>
          </p>
        </Panel>
      </div>

      {staffModal ? (
        <Modal
          title="Add a host"
          description="They join your staff list and are selected for this workshop."
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
                disabled={busy || !draftName.trim()}
                onClick={() => void create("staff")}
              >
                {busy ? "Adding…" : "Add host"}
              </button>
            </>
          }
        >
          <Field label="Name" htmlFor="wks-new-staff">
            <TextInput
              id="wks-new-staff"
              value={draftName}
              placeholder="Alex Rivera"
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {locationModal ? (
        <Modal
          title="Add a location"
          description="It joins your locations and is selected for this workshop."
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
                disabled={busy || !draftName.trim()}
                onClick={() => void create("location")}
              >
                {busy ? "Adding…" : "Add location"}
              </button>
            </>
          }
        >
          <Field label="Name" htmlFor="wks-new-location">
            <TextInput
              id="wks-new-location"
              value={draftName}
              placeholder="Main Studio"
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}

      {resourceModal ? (
        <Modal
          title="Add a resource"
          description="A room or piece of equipment this workshop needs."
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
                disabled={busy || !draftName.trim()}
                onClick={() => void create("resource")}
              >
                {busy ? "Adding…" : "Add resource"}
              </button>
            </>
          }
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Name" htmlFor="wks-new-resource">
              <TextInput
                id="wks-new-resource"
                value={draftName}
                placeholder="Projector"
                onChange={(e) => setDraftName(e.target.value)}
              />
            </Field>
            <Field label="Quantity" htmlFor="wks-new-resource-qty">
              <NumberField
                id="wks-new-resource-qty"
                suffix="available"
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
