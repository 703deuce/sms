"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  CalendarRange,
  Clock,
  Hourglass,
  Info,
  ListOrdered,
  Pencil,
  Plus,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type {
  ResourceOption,
  ServicePhase,
} from "@/features/appointments/kimi/services/use-service-editor";
import type { ServicePhaseKind } from "@/lib/appointments/service-booking/types";
import {
  Field,
  Modal,
  NumberField,
  SectionCard,
  SelectInput,
  TextInput,
} from "@/components/appointments/workspace-ui";
import { formatDurationMinutes } from "@/lib/appointments/duration-display";

type PhaseDraft = {
  id?: string;
  name: string;
  phaseKind: ServicePhaseKind;
  durationMinutes: number;
  staffRequired: boolean;
  resourceIds: string[];
  displayOrder: number;
};

type Props = {
  form: AppointmentTypeFormState;
  phases: ServicePhase[];
  resourceOptions: ResourceOption[];
  namedScheduleOptions: Array<{ id: string; name: string }>;
  workspaceDefaults: {
    startIntervalMinutes: number;
    minimumNoticeMinutes: number;
    maximumDaysAhead: number;
  };
  /** Phases live on a saved row, so the timeline is unavailable while creating. */
  serviceSaved: boolean;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onSavePhase: (phase: PhaseDraft) => Promise<void>;
  onDeletePhase: (id: string) => Promise<void>;
  onMovePhase: (id: string, direction: -1 | 1) => Promise<void>;
};

const START_MODES: Array<{
  value: AppointmentTypeFormState["startTimeMode"];
  label: string;
  helper: string;
}> = [
  {
    value: "standard",
    label: "Standard availability",
    helper: "Slots step through your schedule by the service length.",
  },
  {
    value: "interval",
    label: "Custom start interval",
    helper: "Offer starts on a fixed grid, e.g. every 15 minutes.",
  },
  {
    value: "fixed",
    label: "Fixed start times",
    helper: "Only the exact clock times you list are bookable.",
  },
];

function phaseIcon(kind: ServicePhaseKind) {
  return kind === "processing" ? Hourglass : UserRound;
}

function emptyPhase(order: number): PhaseDraft {
  return {
    name: "",
    phaseKind: "active_staff",
    durationMinutes: 15,
    staffRequired: true,
    resourceIds: [],
    displayOrder: order,
  };
}

/** "9:00" → "9:00 AM", tolerating the raw 24h value the engine stores. */
function prettyTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function ServiceSchedulingSection({
  form,
  phases,
  resourceOptions,
  namedScheduleOptions,
  workspaceDefaults,
  serviceSaved,
  onFormChange,
  onSavePhase,
  onDeletePhase,
  onMovePhase,
}: Props) {
  const [draft, setDraft] = useState<PhaseDraft | null>(null);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [newStart, setNewStart] = useState("09:00");

  const workspaceStartInterval = workspaceDefaults.startIntervalMinutes;
  const phaseTotal = phases.reduce((sum, p) => sum + p.durationMinutes, 0);
  const effectiveDuration = phases.length > 0 ? phaseTotal : form.durationMinutes;
  const blockedTotal = form.bufferBeforeMinutes + effectiveDuration + form.bufferAfterMinutes;

  async function submitPhase() {
    if (!draft || !draft.name.trim() || draft.durationMinutes < 1) return;
    setPhaseSaving(true);
    await onSavePhase({ ...draft, name: draft.name.trim() });
    setPhaseSaving(false);
    setDraft(null);
  }

  function addFixedStart() {
    const value = newStart.trim();
    if (!/^\d{1,2}:\d{2}$/.test(value)) return;
    if (form.fixedStartTimes.includes(value)) return;
    onFormChange(
      "fixedStartTimes",
      [...form.fixedStartTimes, value].sort((a, b) => a.localeCompare(b)),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="ws-section-heading">Scheduling</h2>
        <p className="ws-section-sub">
          How long this service occupies the calendar, and when customers can start it.
        </p>
      </div>

      <SectionCard
        id="service-timing"
        title="Duration & timing"
        description="Buffers extend the block without extending the service."
        icon={Clock}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Buffer before"
            htmlFor="svc-buffer-before"
            hint="Prep time held ahead of the start."
          >
            <NumberField
              id="svc-buffer-before"
              suffix="min"
              min={0}
              step={5}
              value={form.bufferBeforeMinutes}
              onChange={(e) => onFormChange("bufferBeforeMinutes", Number(e.target.value) || 0)}
            />
          </Field>
          <Field
            label="Service duration"
            htmlFor="svc-duration-scheduling"
            hint={
              phases.length > 0
                ? `Phases set the real length (${formatDurationMinutes(phaseTotal)}).`
                : "The time the customer books."
            }
          >
            <NumberField
              id="svc-duration-scheduling"
              suffix="min"
              min={5}
              step={5}
              value={form.durationMinutes}
              disabled={phases.length > 0}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 5)}
            />
          </Field>
          <Field
            label="Buffer after"
            htmlFor="svc-buffer-after"
            hint="Turnaround held after the end."
          >
            <NumberField
              id="svc-buffer-after"
              suffix="min"
              min={0}
              step={5}
              value={form.bufferAfterMinutes}
              onChange={(e) => onFormChange("bufferAfterMinutes", Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="ws-timing-bar" role="img" aria-label={`Calendar block: ${blockedTotal} minutes total`}>
          {form.bufferBeforeMinutes > 0 ? (
            <span className="ws-timing-seg is-buffer" style={{ flexGrow: form.bufferBeforeMinutes }}>
              <span className="ws-timing-seg-label">Before</span>
              <span className="ws-timing-seg-value">{form.bufferBeforeMinutes}m</span>
            </span>
          ) : null}
          <span className="ws-timing-seg is-service" style={{ flexGrow: Math.max(effectiveDuration, 10) }}>
            <span className="ws-timing-seg-label">Service</span>
            <span className="ws-timing-seg-value">{formatDurationMinutes(effectiveDuration)}</span>
          </span>
          {form.bufferAfterMinutes > 0 ? (
            <span className="ws-timing-seg is-buffer" style={{ flexGrow: form.bufferAfterMinutes }}>
              <span className="ws-timing-seg-label">After</span>
              <span className="ws-timing-seg-value">{form.bufferAfterMinutes}m</span>
            </span>
          ) : null}
        </div>
        <p className="ws-field-hint mt-2">
          Each booking holds {formatDurationMinutes(blockedTotal)} of calendar time.
        </p>
      </SectionCard>

      <SectionCard
        id="service-phases"
        title="Service phases"
        description="Split the service into steps when part of it does not need the provider."
        icon={ListOrdered}
        action={
          serviceSaved ? (
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => setDraft(emptyPhase(phases.length))}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add phase
            </button>
          ) : null
        }
      >
        {!serviceSaved ? (
          <p className="ws-field-hint">Save the service first — phases attach to a saved service.</p>
        ) : phases.length === 0 ? (
          <div className="ws-empty-inline">
            <span className="ws-empty-inline-icon" aria-hidden>
              <Hourglass className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                One continuous {formatDurationMinutes(form.durationMinutes)} block
              </p>
              <p className="ws-field-hint">
                Add phases for services with processing time — colour development, equipment cycles,
                a treatment that sets while the provider steps away.
              </p>
            </div>
            <button
              type="button"
              className="appt-pilot-outline-btn shrink-0"
              onClick={() => setDraft(emptyPhase(0))}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add phase
            </button>
          </div>
        ) : (
          <>
            <ol className="ws-phase-list">
              {phases.map((phase, index) => {
                const Icon = phaseIcon(phase.phaseKind);
                return (
                  <li key={phase.id} className="ws-phase-item">
                    <span className="ws-phase-rail" aria-hidden>
                      <span className="ws-phase-index">{index + 1}</span>
                      {index < phases.length - 1 ? <span className="ws-phase-connector" /> : null}
                    </span>
                    <div className={`ws-phase-card${phase.phaseKind === "processing" ? " is-processing" : ""}`}>
                      <span className="ws-phase-icon" aria-hidden>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="ws-phase-name">{phase.name}</p>
                        <p className="ws-phase-meta">
                          {formatDurationMinutes(phase.durationMinutes)} ·{" "}
                          {phase.staffRequired ? "Provider required" : "Provider released"}
                          {phase.resourceIds.length > 0
                            ? ` · ${phase.resourceIds.length} resource${phase.resourceIds.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="ws-icon-btn"
                          aria-label={`Move ${phase.name} earlier`}
                          disabled={index === 0}
                          onClick={() => void onMovePhase(phase.id, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="ws-icon-btn"
                          aria-label={`Move ${phase.name} later`}
                          disabled={index === phases.length - 1}
                          onClick={() => void onMovePhase(phase.id, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="ws-icon-btn"
                          aria-label={`Edit ${phase.name}`}
                          onClick={() => setDraft({ ...phase })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="ws-icon-btn danger"
                          aria-label={`Remove ${phase.name}`}
                          onClick={() => void onDeletePhase(phase.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="ws-phase-total">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              Phases total {formatDurationMinutes(phaseTotal)} — this is the duration customers book.
            </div>
            <p className="ws-field-hint mt-2 flex items-start gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Released phases still reserve the provider today. Resource requirements on a phase are
              enforced for that phase&rsquo;s window.
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard
        id="service-start-times"
        title="Start times"
        description="Which clock times customers may choose."
        icon={AlarmClock}
      >
        <div className="space-y-1.5">
          {START_MODES.map((mode) => (
            <label key={mode.value} className="ws-radio-row">
              <input
                type="radio"
                name="service-start-mode"
                value={mode.value}
                checked={form.startTimeMode === mode.value}
                onChange={() => onFormChange("startTimeMode", mode.value)}
              />
              <span className="min-w-0">
                <span className="ws-radio-label block">{mode.label}</span>
                <span className="ws-field-hint block">
                  {mode.value === "standard" && workspaceStartInterval > 0
                    ? `Your workspace starts everything on a ${workspaceStartInterval}-minute grid, so this service follows that.`
                    : mode.helper}
                </span>
              </span>
            </label>
          ))}
        </div>

        {form.startTimeMode === "interval" ? (
          <div className="mt-4 max-w-xs">
            <Field
              label="Start every"
              htmlFor="svc-start-interval"
              hint="Slots begin on this grid regardless of service length."
            >
              <NumberField
                id="svc-start-interval"
                suffix="min"
                min={5}
                step={5}
                value={form.customStartIntervalMinutes}
                onChange={(e) =>
                  onFormChange("customStartIntervalMinutes", Number(e.target.value) || 15)
                }
              />
            </Field>
          </div>
        ) : null}

        {form.startTimeMode === "fixed" ? (
          <div className="mt-4">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
              Bookable start times
            </p>
            {form.fixedStartTimes.length === 0 ? (
              <p className="ws-inline-error mt-1">
                Add at least one start time or customers will see no availability.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.fixedStartTimes.map((time) => (
                  <span key={time} className="ws-removable-chip">
                    {prettyTime(time)}
                    <button
                      type="button"
                      aria-label={`Remove ${prettyTime(time)}`}
                      onClick={() =>
                        onFormChange(
                          "fixedStartTimes",
                          form.fixedStartTimes.filter((t) => t !== time),
                        )
                      }
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-end gap-2">
              <div className="w-36">
                <Field label="Add a start time" htmlFor="svc-fixed-start">
                  <TextInput
                    id="svc-fixed-start"
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                  />
                </Field>
              </div>
              <button type="button" className="appt-pilot-outline-btn mb-0.5" onClick={addFixedStart}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            </div>
          </div>
        ) : null}

        <div className="ws-default-field mt-4">
          <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Availability schedule:{" "}
            <strong className="font-medium text-[var(--text-primary)]">
              {namedScheduleOptions.find((s) => s.id === form.namedScheduleId)?.name ||
                "Workspace default hours"}
            </strong>
          </span>
          {namedScheduleOptions.length > 0 ? (
            <SelectInput
              aria-label="Availability schedule"
              className="w-auto"
              value={form.namedScheduleId}
              onChange={(e) => onFormChange("namedScheduleId", e.target.value)}
            >
              <option value="">Workspace default</option>
              {namedScheduleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          ) : null}
          <Link href="/appointments/availability" className="appt-pilot-muted-link shrink-0">
            Manage availability
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        id="service-booking-window"
        title="Booking window"
        description="How far ahead customers may book, and how late."
        icon={CalendarRange}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Minimum notice"
            htmlFor="svc-min-notice"
            hint={
              form.minimumBookingNoticeMinutes > 0
                ? `Overrides the workspace default of ${workspaceDefaults.minimumNoticeMinutes} min.`
                : `0 inherits the workspace default of ${workspaceDefaults.minimumNoticeMinutes} min.`
            }
          >
            <NumberField
              id="svc-min-notice"
              suffix="min"
              min={0}
              step={15}
              value={form.minimumBookingNoticeMinutes}
              onChange={(e) =>
                onFormChange("minimumBookingNoticeMinutes", Number(e.target.value) || 0)
              }
            />
          </Field>
          <Field
            label="Booking horizon"
            htmlFor="svc-horizon"
            hint={
              form.maximumBookingDaysAhead > 0
                ? `Overrides the workspace default of ${workspaceDefaults.maximumDaysAhead} days.`
                : `0 inherits the workspace default of ${workspaceDefaults.maximumDaysAhead} days.`
            }
          >
            <NumberField
              id="svc-horizon"
              suffix="days"
              min={0}
              value={form.maximumBookingDaysAhead}
              onChange={(e) =>
                onFormChange("maximumBookingDaysAhead", Number(e.target.value) || 0)
              }
            />
          </Field>
        </div>
      </SectionCard>

      {draft ? (
        <Modal
          title={draft.id ? "Edit phase" : "Add phase"}
          description="Phases run back to back and together define how long the service takes."
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!draft.name.trim() || draft.durationMinutes < 1 || phaseSaving}
                onClick={() => void submitPhase()}
              >
                {phaseSaving ? "Saving…" : draft.id ? "Save phase" : "Add phase"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Phase name" htmlFor="phase-name">
              <TextInput
                id="phase-name"
                value={draft.name}
                placeholder="Colour processing"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" htmlFor="phase-kind">
                <SelectInput
                  id="phase-kind"
                  value={draft.phaseKind}
                  onChange={(e) => {
                    const kind = e.target.value as ServicePhaseKind;
                    setDraft({ ...draft, phaseKind: kind, staffRequired: kind === "active_staff" });
                  }}
                >
                  <option value="active_staff">Active service</option>
                  <option value="processing">Processing</option>
                </SelectInput>
              </Field>
              <Field label="Duration" htmlFor="phase-duration">
                <NumberField
                  id="phase-duration"
                  suffix="min"
                  min={1}
                  step={5}
                  value={draft.durationMinutes}
                  onChange={(e) =>
                    setDraft({ ...draft, durationMinutes: Number(e.target.value) || 1 })
                  }
                />
              </Field>
            </div>
            {resourceOptions.length > 0 ? (
              <Field
                label="Resources held during this phase"
                hint="Only these are reserved for the phase window."
              >
                <div className="flex flex-wrap gap-2">
                  {resourceOptions.map((r) => {
                    const on = draft.resourceIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="ws-host-chip"
                        aria-pressed={on}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            resourceIds: on
                              ? draft.resourceIds.filter((x) => x !== r.id)
                              : [...draft.resourceIds, r.id],
                          })
                        }
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
