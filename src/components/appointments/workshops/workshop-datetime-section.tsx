"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Clock,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  Field,
  Modal,
  NumberField,
  Panel,
  SelectInput,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import {
  dateBlock,
  durationLabel,
  formatSessionDay,
  formatSessionTimes,
  primarySession,
  sessionRowToDraft,
  todayISODate,
  upcomingSessions,
  type WorkshopSessionDraft,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";

type Props = {
  form: WorkshopFormState;
  sessions: WorkshopSessionRow[];
  registeredCount: number;
  saving: boolean;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
  onAddSession: (draft: WorkshopSessionDraft) => Promise<boolean>;
  onUpdateSession: (id: string, draft: WorkshopSessionDraft) => Promise<boolean>;
  onCancelSession: (id: string) => void;
};

const DURATION_PRESETS = [60, 90, 120, 180, 240, 480];

const TIMEZONES = [
  "",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

/** The editing grid, shared by the primary session and the add/edit dialogs. */
function SessionFields({
  draft,
  idPrefix,
  onChange,
}: {
  draft: WorkshopSessionDraft;
  idPrefix: string;
  onChange: (next: WorkshopSessionDraft) => void;
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <TextInput
          id={`${idPrefix}-date`}
          type="date"
          value={draft.date}
          min={todayISODate()}
          onChange={(e) => onChange({ ...draft, date: e.target.value })}
        />
      </Field>
      <Field label="Start time" htmlFor={`${idPrefix}-start`}>
        <TextInput
          id={`${idPrefix}-start`}
          type="time"
          value={draft.startTime}
          onChange={(e) => onChange({ ...draft, startTime: e.target.value })}
        />
      </Field>
      <Field
        label="Duration"
        htmlFor={`${idPrefix}-duration`}
        hint={durationLabel(draft.durationMinutes)}
      >
        <NumberField
          id={`${idPrefix}-duration`}
          suffix="minutes"
          min={5}
          step={5}
          value={draft.durationMinutes}
          onChange={(e) =>
            onChange({ ...draft, durationMinutes: Number(e.target.value) || draft.durationMinutes })
          }
        />
      </Field>
      <Field label="Length preset" htmlFor={`${idPrefix}-preset`} hint="Sets the duration above.">
        <SelectInput
          id={`${idPrefix}-preset`}
          value={DURATION_PRESETS.includes(draft.durationMinutes) ? draft.durationMinutes : ""}
          onChange={(e) =>
            e.target.value && onChange({ ...draft, durationMinutes: Number(e.target.value) })
          }
        >
          <option value="">Custom</option>
          {DURATION_PRESETS.map((m) => (
            <option key={m} value={m}>
              {durationLabel(m)}
            </option>
          ))}
        </SelectInput>
      </Field>
    </div>
  );
}

export function WorkshopDatetimeSection({
  form,
  sessions,
  registeredCount,
  saving,
  onFormChange,
  onAddSession,
  onUpdateSession,
  onCancelSession,
}: Props) {
  const session = primarySession(sessions);
  const live = sessions
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcoming = upcomingSessions(sessions);

  const [editing, setEditing] = useState<WorkshopSessionRow | null>(null);
  const [editDraft, setEditDraft] = useState<WorkshopSessionDraft>(form.schedule);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<WorkshopSessionDraft>(form.schedule);
  const [confirmDateChange, setConfirmDateChange] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WorkshopSessionRow | null>(null);

  useEffect(() => {
    if (editing) setEditDraft(sessionRowToDraft(editing));
  }, [editing]);

  /**
   * Moving the day people already committed to is not a settings change, so
   * the warning appears before the write rather than as a toast after it.
   */
  function requestPrimaryChange() {
    if (registeredCount > 0) setConfirmDateChange(true);
    else void commitPrimaryChange();
  }

  async function commitPrimaryChange() {
    setConfirmDateChange(false);
    if (session) await onUpdateSession(session.id, form.schedule);
    else await onAddSession(form.schedule);
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Primary session" icon={CalendarDays} className="ws-span-8">
          {session ? (
            <div className="ws-event-head mb-3.5">
              <span className="ws-date-block" aria-hidden>
                <span className="ws-date-block-month">{dateBlock(session.startsAt).month}</span>
                <span className="ws-date-block-day">{dateBlock(session.startsAt).day}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
                  {formatSessionDay(session.startsAt)}
                </p>
                <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
                  {formatSessionTimes(session.startsAt, session.endsAt)}
                  {form.timezone ? ` · ${form.timezone}` : ""}
                </p>
              </div>
            </div>
          ) : null}

          <SessionFields
            draft={form.schedule}
            idPrefix="wks-primary"
            onChange={(next) => onFormChange("schedule", next)}
          />

          <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
            <Field
              label="Timezone"
              htmlFor="wks-timezone"
              hint="Shown to customers beside the time."
            >
              <SelectInput
                id="wks-timezone"
                value={form.timezone}
                onChange={(e) => onFormChange("timezone", e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz || "unset"} value={tz}>
                    {tz || "Business default"}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className="appt-pilot-primary-btn w-full justify-center"
                disabled={saving || !form.schedule.date}
                onClick={requestPrimaryChange}
              >
                {session ? "Update this date" : "Set the date"}
              </button>
            </div>
          </div>
          <p className="ws-field-hint mt-2">
            The date is saved to the session straight away, separately from Save changes.
          </p>
        </Panel>

        <Panel title="Quick actions" icon={Sparkles} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            {live.length === 0
              ? "This workshop has no sessions yet."
              : live.length === 1
                ? "A single-session workshop."
                : `Runs across ${live.length} sessions.`}
          </p>
          <button
            type="button"
            className="appt-pilot-outline-btn mt-3 w-full justify-center"
            onClick={() => {
              setAddDraft({ ...form.schedule, date: "" });
              setAdding(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Add another session
          </button>
          <p className="ws-field-hint mt-2">
            Add a session if this workshop spans more than one day. Everyone registered is
            registered for the whole workshop.
          </p>
          <dl className="ws-detail-list mt-3.5">
            <div>
              <dt>Upcoming</dt>
              <dd>{upcoming.length}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{registeredCount}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd>{sessions.filter((s) => s.status === "cancelled").length}</dd>
            </div>
          </dl>
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
              {live.length} scheduled
            </span>
          }
        >
          {sessions.length === 0 ? (
            <div className="ws-empty-inline" style={{ margin: "0.875rem" }}>
              <span className="ws-empty-inline-icon">
                <CalendarDays className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No workshop sessions
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Set the date above, then add another session if this workshop spans multiple
                  dates.
                </p>
              </div>
            </div>
          ) : (
            <ol className="ws-timeline">
              {sessions
                .slice()
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                .map((s, index) => {
                  const cancelled = s.status === "cancelled";
                  const block = dateBlock(s.startsAt);
                  return (
                    <li
                      key={s.id}
                      className={`ws-timeline-item${cancelled ? " is-cancelled" : ""}`}
                    >
                      <span className="ws-timeline-marker" aria-hidden />
                      <span className="ws-date-block is-compact" aria-hidden>
                        <span className="ws-date-block-month">{block.month}</span>
                        <span className="ws-date-block-day">{block.day}</span>
                      </span>
                      <span className="ws-row-main">
                        <span className="ws-row-primary">
                          {live.length > 1 ? `Day ${index + 1} · ` : ""}
                          {formatSessionDay(s.startsAt)}
                        </span>
                        <span className="ws-row-secondary">
                          <span>{formatSessionTimes(s.startsAt, s.endsAt)}</span>
                          {cancelled ? (
                            <span className="ws-chip ws-chip-warning">Cancelled</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="ws-row-metric">
                        <strong>
                          {s.enrolled ?? 0}/{s.capacity ?? form.capacity}
                        </strong>
                        <span className="ws-cell-sub">registered</span>
                      </span>
                      <span className="ws-row-actions">
                        <button
                          type="button"
                          className="ws-text-btn"
                          onClick={() => setEditing(s)}
                          disabled={cancelled}
                        >
                          Edit
                        </button>
                        {!cancelled ? (
                          <button
                            type="button"
                            className="ws-text-btn is-danger"
                            onClick={() => setCancelTarget(s)}
                          >
                            <CalendarX className="h-3 w-3" aria-hidden />
                            Cancel
                          </button>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
            </ol>
          )}
          <div className="border-t border-[var(--border)] px-3.5 py-2.5">
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => {
                setAddDraft({ ...form.schedule, date: "" });
                setAdding(true);
              }}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add session
            </button>
          </div>
        </Panel>
      </div>

      {adding ? (
        <Modal
          title="Add a session"
          description="Another day this same workshop runs on. Registrations cover every session."
          onClose={() => setAdding(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={saving || !addDraft.date}
                onClick={() => {
                  void onAddSession(addDraft).then((ok) => {
                    if (ok) setAdding(false);
                  });
                }}
              >
                {saving ? "Adding…" : "Add session"}
              </button>
            </>
          }
        >
          <SessionFields draft={addDraft} idPrefix="wks-add" onChange={setAddDraft} />
        </Modal>
      ) : null}

      {editing ? (
        <Modal
          title="Edit this session"
          description={
            registeredCount > 0
              ? `${registeredCount} ${registeredCount === 1 ? "customer is" : "customers are"} registered for this workshop.`
              : "Change when this session runs."
          }
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
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={saving || !editDraft.date}
                onClick={() => {
                  void onUpdateSession(editing.id, editDraft).then((ok) => {
                    if (ok) setEditing(null);
                  });
                }}
              >
                {saving ? "Saving…" : "Save session"}
              </button>
            </>
          }
        >
          <SessionFields draft={editDraft} idPrefix="wks-edit" onChange={setEditDraft} />
        </Modal>
      ) : null}

      {confirmDateChange ? (
        <Modal
          title="Move this workshop?"
          onClose={() => setConfirmDateChange(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setConfirmDateChange(false)}
              >
                Keep the current date
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={saving}
                onClick={() => void commitPrimaryChange()}
              >
                {saving ? "Moving…" : "Move the workshop"}
              </button>
            </>
          }
        >
          <p className="flex items-start gap-2 text-[var(--type-list)] text-[var(--text-secondary)]">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--state-warning)]"
              aria-hidden
            />
            <span>
              {registeredCount} {registeredCount === 1 ? "customer is" : "customers are"} registered
              for this workshop. Their registrations stay, but they are not told about the new date
              automatically — the reminder system does not send a change notice yet, so tell them
              yourself.
            </span>
          </p>
        </Modal>
      ) : null}

      {cancelTarget ? (
        <Modal
          title="Cancel this session?"
          onClose={() => setCancelTarget(null)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setCancelTarget(null)}
              >
                Keep the session
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                onClick={() => {
                  onCancelSession(cancelTarget.id);
                  setCancelTarget(null);
                }}
              >
                Cancel session
              </button>
            </>
          }
        >
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            {formatSessionDay(cancelTarget.startsAt)} ·{" "}
            {formatSessionTimes(cancelTarget.startsAt, cancelTarget.endsAt)} stops accepting
            registrations and drops off the public page. Existing registrations are kept on the
            record.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
