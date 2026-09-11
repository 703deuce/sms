"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Clock,
  Repeat,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Field,
  Modal,
  Panel,
  SelectInput,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { ClassFormState, ClassOccurrenceRow } from "@/lib/appointments/classes/class-form";
import {
  describeClassRecurrence,
  expandClassRecurrence,
  WEEKDAY_LABELS,
  withStartDate,
} from "@/lib/appointments/classes/class-recurrence";
import { formatSessionRange } from "@/lib/appointments/classes/class-summary";

type Props = {
  form: ClassFormState;
  occurrences: ClassOccurrenceRow[];
  classSaved: boolean;
  staffNames: Map<string, string>;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
  onGenerate: (planned: Array<{ startsAt: string; endsAt: string }>) => Promise<boolean>;
  onCancelOccurrence: (id: string) => void;
  onUpdateOccurrence: (
    id: string,
    patch: { startsAt?: string; endsAt?: string; capacity?: number },
  ) => void;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minutesBetween(startsAt: string, endsAt: string): number {
  return Math.max(5, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
}

export function ClassScheduleSection({
  form,
  occurrences,
  classSaved,
  staffNames,
  onFormChange,
  onGenerate,
  onCancelOccurrence,
  onUpdateOccurrence,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<ClassOccurrenceRow | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editCapacity, setEditCapacity] = useState(0);

  const rule = form.recurrence;
  const planned = useMemo(() => expandClassRecurrence(rule), [rule]);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const sorted = useMemo(
    () =>
      [...occurrences].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    [occurrences],
  );

  /**
   * A generated session that has since been edited or cancelled is an
   * exception to the pattern, and that is exactly what an operator needs
   * flagged — the rule alone no longer describes what will happen.
   */
  const plannedStartTimes = useMemo(
    () => new Set(planned.map((p) => new Date(p.startsAt).getTime())),
    [planned],
  );

  function setRule<K extends keyof typeof rule>(key: K, value: (typeof rule)[K]) {
    onFormChange("recurrence", { ...rule, [key]: value });
  }

  function setStartDate(value: string) {
    onFormChange("recurrence", withStartDate(rule, value));
  }

  function toggleWeekday(day: number) {
    const next = rule.weekdays.includes(day)
      ? rule.weekdays.filter((d) => d !== day)
      : [...rule.weekdays, day].sort();
    setRule("weekdays", next);
  }

  async function generate() {
    setGenerating(true);
    await onGenerate(planned);
    setGenerating(false);
  }

  function openEdit(occ: ClassOccurrenceRow) {
    setEditing(occ);
    setEditStart(toLocalInput(occ.startsAt));
    setEditDuration(minutesBetween(occ.startsAt, occ.endsAt));
    setEditCapacity(Number(occ.capacity ?? form.capacity));
  }

  function saveEdit() {
    if (!editing) return;
    const start = new Date(editStart);
    if (Number.isNaN(start.getTime())) return;
    onUpdateOccurrence(editing.id, {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + editDuration * 60_000).toISOString(),
      capacity: editCapacity,
    });
    setEditing(null);
  }

  const alreadyGenerated = new Set(sorted.map((o) => new Date(o.startsAt).getTime()));
  const newSessions = planned.filter((p) => !alreadyGenerated.has(new Date(p.startsAt).getTime()));

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Pattern" icon={Repeat} className="ws-span-8">
          <div className="ws-pattern-grid">
            <button
              type="button"
              className="ws-pattern-card"
              aria-pressed={rule.pattern === "one_time"}
              onClick={() => setRule("pattern", "one_time")}
            >
              <span className="ws-pattern-icon" aria-hidden>
                <CalendarDays className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="ws-pattern-name">One-time</span>
                <span className="ws-pattern-help">A single session on one date.</span>
              </span>
            </button>
            <button
              type="button"
              className="ws-pattern-card"
              aria-pressed={rule.pattern === "repeating"}
              onClick={() => setRule("pattern", "repeating")}
            >
              <span className="ws-pattern-icon" aria-hidden>
                <CalendarRange className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="ws-pattern-name">Repeating</span>
                <span className="ws-pattern-help">
                  Runs on a cadence until it ends or reaches a session count.
                </span>
              </span>
            </button>
          </div>

          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <Field label="Start date" htmlFor="cls-start-date">
              <TextInput
                id="cls-start-date"
                type="date"
                value={rule.startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Start time" htmlFor="cls-start-time">
              <TextInput
                id="cls-start-time"
                type="time"
                value={rule.startTime}
                onChange={(e) => setRule("startTime", e.target.value)}
              />
            </Field>
            <Field label="Duration" htmlFor="cls-duration" hint="Minutes each session runs.">
              <TextInput
                id="cls-duration"
                type="number"
                min={5}
                step={5}
                value={rule.durationMinutes}
                onChange={(e) => setRule("durationMinutes", Number(e.target.value) || 60)}
              />
            </Field>
            <Field
              label="Timezone"
              htmlFor="cls-timezone"
              hint={`Times are entered in ${browserZone}.`}
            >
              <SelectInput
                id="cls-timezone"
                value={form.timezone || browserZone}
                onChange={(e) => onFormChange("timezone", e.target.value)}
              >
                {[browserZone, ...TIMEZONES.filter((z) => z !== browserZone)].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          {rule.pattern === "repeating" ? (
            <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
              <Field label="Repeat" htmlFor="cls-repeat">
                <div className="flex flex-wrap items-center gap-2">
                  <SelectInput
                    id="cls-repeat"
                    className="max-w-[10rem]"
                    value={rule.repeat}
                    onChange={(e) => setRule("repeat", e.target.value as typeof rule.repeat)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </SelectInput>
                  {rule.repeat === "weekly" || rule.repeat === "biweekly" ? (
                    <div className="ws-day-chips" role="group" aria-label="Days of the week">
                      {WEEKDAY_LABELS.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className="ws-day-chip"
                          aria-pressed={rule.weekdays.includes(index)}
                          onClick={() => toggleWeekday(index)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Field>
              <Field label="Ends" htmlFor="cls-ends">
                <div className="flex flex-wrap items-center gap-2">
                  <SelectInput
                    id="cls-ends"
                    className="max-w-[9rem]"
                    value={rule.endsMode}
                    onChange={(e) => setRule("endsMode", e.target.value as typeof rule.endsMode)}
                  >
                    <option value="after">After</option>
                    <option value="on">On date</option>
                    <option value="never">No end date</option>
                  </SelectInput>
                  {rule.endsMode === "after" ? (
                    <span className="ws-suffix-field max-w-[9rem]">
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={60}
                        aria-label="Number of sessions"
                        value={rule.endsAfter}
                        onChange={(e) => setRule("endsAfter", Number(e.target.value) || 1)}
                      />
                      <span>sessions</span>
                    </span>
                  ) : null}
                  {rule.endsMode === "on" ? (
                    <TextInput
                      className="max-w-[11rem]"
                      type="date"
                      aria-label="Last date"
                      value={rule.endsOn}
                      onChange={(e) => setRule("endsOn", e.target.value)}
                    />
                  ) : null}
                </div>
              </Field>
            </div>
          ) : null}
        </Panel>

        <Panel title="Quick actions" icon={Wand2} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {describeClassRecurrence(rule)}
          </p>
          <p className="ws-stat-note">
            {planned.length === 0
              ? "Set a start date to preview the sessions this pattern produces."
              : `This pattern produces ${planned.length} session${planned.length === 1 ? "" : "s"}, ${newSessions.length} of which are not created yet.`}
          </p>
          <button
            type="button"
            className="appt-pilot-primary-btn mt-3 w-full justify-center"
            disabled={!classSaved || newSessions.length === 0 || generating}
            title={
              !classSaved
                ? "Save the class before generating sessions"
                : newSessions.length === 0
                  ? "Every session in this pattern already exists"
                  : undefined
            }
            onClick={() => void generate()}
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            {generating
              ? "Creating…"
              : `Create ${newSessions.length || ""} session${newSessions.length === 1 ? "" : "s"}`.trim()}
          </button>
          {!classSaved ? (
            <p className="ws-gap-note mt-3">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Sessions attach to a saved class, so save this one first.
            </p>
          ) : null}
          <p className="ws-stat-note">
            Editing the pattern never rewrites sessions that already exist. Change one directly in
            the list below and it is kept as an exception.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Sessions"
          icon={Clock}
          className="ws-span-12"
          flush
          actions={
            <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
              {sorted.length} total
            </span>
          }
        >
          {sorted.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                No sessions yet
              </p>
              <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
                Set a pattern above, then create the sessions it describes.
              </p>
            </div>
          ) : (
            <div className="ws-row-list">
              {sorted.map((occ) => {
                const start = new Date(occ.startsAt);
                const cancelled = occ.status === "cancelled";
                const capacity = Number(occ.capacity ?? form.capacity);
                const enrolled = Number(occ.enrolled ?? 0);
                const offPattern =
                  !cancelled && planned.length > 0 && !plannedStartTimes.has(start.getTime());
                const instructor = form.staffId ? staffNames.get(form.staffId) : null;
                return (
                  <div
                    key={occ.id}
                    className={`ws-row-item${cancelled ? " is-cancelled" : ""}`}
                  >
                    <span className="ws-row-lead" aria-hidden>
                      <span className="ws-row-lead-top">
                        {start.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="ws-row-lead-main">{start.getDate()}</span>
                    </span>
                    <span className="ws-row-main">
                      <span className="ws-row-primary">
                        {formatSessionRange(occ.startsAt, occ.endsAt)}
                      </span>
                      <span className="ws-row-secondary">
                        {instructor ? <span>{instructor}</span> : null}
                        {cancelled ? (
                          <span className="ws-chip ws-chip-neutral">Cancelled</span>
                        ) : null}
                        {offPattern ? (
                          <span className="ws-chip ws-chip-warning">Time changed</span>
                        ) : null}
                        {!cancelled && capacity !== form.capacity ? (
                          <span className="ws-chip ws-chip-warning">Capacity changed</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="ws-row-metric">
                      <strong>
                        {enrolled}/{capacity}
                      </strong>
                      <span className="ws-cell-sub">registered</span>
                    </span>
                    <span className="ws-row-actions">
                      <button type="button" className="ws-text-btn" onClick={() => openEdit(occ)}>
                        Edit
                      </button>
                      {!cancelled ? (
                        <button
                          type="button"
                          className="ws-text-btn"
                          onClick={() => onCancelOccurrence(occ.id)}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          Cancel
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {editing ? (
        <Modal
          title="Edit session"
          description="Changes apply to this session only."
          onClose={() => setEditing(null)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="button" className="appt-pilot-primary-btn" onClick={saveEdit}>
                Save session
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="occ-start">
              <TextInput
                id="occ-start"
                type="datetime-local"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </Field>
            <Field label="Duration" htmlFor="occ-duration" hint="Minutes.">
              <TextInput
                id="occ-duration"
                type="number"
                min={5}
                step={5}
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value) || 60)}
              />
            </Field>
            <Field
              label="Capacity"
              htmlFor="occ-capacity"
              hint={`Class default is ${form.capacity}.`}
            >
              <TextInput
                id="occ-capacity"
                type="number"
                min={1}
                value={editCapacity}
                onChange={(e) => setEditCapacity(Number(e.target.value) || 1)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
