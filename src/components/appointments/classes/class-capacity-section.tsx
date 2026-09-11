"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  ExternalLink,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  Drawer,
  Field,
  Panel,
  SelectInput,
  Switch,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { ClassFormState, ClassOccurrenceRow } from "@/lib/appointments/classes/class-form";
import {
  formatSessionRange,
  nextOccurrence,
  registrationState,
  seatsForNextSession,
  upcomingOccurrences,
} from "@/lib/appointments/classes/class-summary";
import type {
  ClassRegistrant,
  ClassWaitlistEntry,
} from "@/features/appointments/kimi/classes/use-class-editor";

type Props = {
  form: ClassFormState;
  occurrences: ClassOccurrenceRow[];
  registrants: ClassRegistrant[];
  waitlist: ClassWaitlistEntry[];
  classSaved: boolean;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
  onUpdateRegistration: (
    id: string,
    patch: { status?: string; attendance?: string | null },
  ) => void;
  onPromoteWaitlist: (entryId: string, occurrenceId: string) => Promise<boolean>;
  onRemoveWaitlist: (entryId: string) => void;
};

const ATTENDANCE_LABEL: Record<string, string> = {
  attended: "Attended",
  no_show: "No-show",
  late_cancel: "Late cancel",
};

const WAITLIST_STATUS_LABEL: Record<string, string> = {
  active: "Waiting",
  offered: "Seat offered",
  converted: "Registered",
  expired: "Offer expired",
  removed: "Removed",
};

function accessLabel(registrant: ClassRegistrant, form: ClassFormState): string {
  if (registrant.access) return registrant.access;
  return form.isFree ? "Free" : "Due on arrival";
}

export function ClassCapacitySection({
  form,
  occurrences,
  registrants,
  waitlist,
  classSaved,
  onFormChange,
  onUpdateRegistration,
  onPromoteWaitlist,
  onRemoveWaitlist,
}: Props) {
  const [sessionFilter, setSessionFilter] = useState("");
  const [detail, setDetail] = useState<ClassRegistrant | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState("");

  const upcoming = upcomingOccurrences(occurrences);
  const next = nextOccurrence(occurrences);
  const seats = seatsForNextSession(form, occurrences);
  const state = registrationState(form, occurrences);
  const fillPct = seats.capacity > 0 ? Math.min(100, (seats.enrolled / seats.capacity) * 100) : 0;

  const sessionLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const occ of occurrences) {
      map.set(occ.id, formatSessionRange(occ.startsAt, occ.endsAt));
    }
    return map;
  }, [occurrences]);

  const visible = useMemo(
    () => (sessionFilter ? registrants.filter((r) => r.occurrenceId === sessionFilter) : registrants),
    [registrants, sessionFilter],
  );

  const active = registrants.filter((r) => r.status === "enrolled").length;

  async function promote(entryId: string) {
    const target = promoteTarget || next?.id;
    if (!target) return;
    setPromoting(entryId);
    await onPromoteWaitlist(entryId, target);
    setPromoting(null);
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Capacity" icon={Users} className="ws-span-4">
          <div className="ws-stat">
            <span className="ws-stat-value">{seats.enrolled}</span>
            <span className="ws-stat-unit">of {seats.capacity} seats taken</span>
          </div>
          <div className={`ws-meter${seats.remaining === 0 ? " is-full" : ""}`}>
            <span style={{ width: `${fillPct}%` }} />
          </div>
          <p className="ws-stat-note">
            {next ? `Next session ${formatSessionRange(next.startsAt, next.endsAt)}.` : "No session scheduled."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Seats per session"
              htmlFor="cls-capacity"
              hint="Enforced by the server at registration."
            >
              <TextInput
                id="cls-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => onFormChange("capacity", Number(e.target.value) || 1)}
              />
            </Field>
          </div>
          <div className="mt-2">
            <Switch
              checked={form.showRemainingSpots}
              onChange={(v) => onFormChange("showRemainingSpots", v)}
              label="Show remaining spots"
              description="Public page displays how many seats are left."
            />
          </div>
        </Panel>

        <Panel title="Registration status" icon={DoorOpen} className="ws-span-4">
          <span
            className={`ws-chip ${
              state.tone === "open"
                ? "ws-chip-success"
                : state.tone === "full"
                  ? "ws-chip-warning"
                  : "ws-chip-neutral"
            }`}
          >
            {state.label}
          </span>
          <p className="ws-stat-note">{state.detail}</p>
          <div className="mt-3 grid gap-3">
            <Field label="Registration opens" htmlFor="cls-reg-opens" hint="Leave blank to open immediately.">
              <TextInput
                id="cls-reg-opens"
                type="datetime-local"
                value={form.registrationOpensAt}
                onChange={(e) => onFormChange("registrationOpensAt", e.target.value)}
              />
            </Field>
            <Field label="Registration closes" htmlFor="cls-reg-closes" hint="Leave blank to stay open until the session starts.">
              <TextInput
                id="cls-reg-closes"
                type="datetime-local"
                value={form.registrationClosesAt}
                onChange={(e) => onFormChange("registrationClosesAt", e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-2">
            <Switch
              checked={form.requireFullSeries}
              onChange={(v) => onFormChange("requireFullSeries", v)}
              label="Register for the whole series"
              description="Customers take every session at once rather than picking one."
            />
          </div>
        </Panel>

        <Panel
          title="Waitlist"
          icon={ClipboardList}
          className="ws-span-4"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              disabled={waitlist.length === 0}
              onClick={() => setWaitlistOpen(true)}
            >
              Manage
            </button>
          }
        >
          <div className="ws-stat">
            <span className="ws-stat-value">{waitlist.length}</span>
            <span className="ws-stat-unit">waiting</span>
          </div>
          <p className="ws-stat-note">
            {form.waitlistEnabled
              ? "When the next session is full, new registrations join the waitlist."
              : "The waitlist is off, so a full session simply cannot be registered for."}
          </p>
          <div className="mt-3 space-y-2">
            <Switch
              checked={form.waitlistEnabled}
              onChange={(v) => onFormChange("waitlistEnabled", v)}
              label="Enable waitlist"
            />
            {form.waitlistEnabled ? (
              <>
                <Switch
                  checked={form.waitlistAutoPromote}
                  onChange={(v) => onFormChange("waitlistAutoPromote", v)}
                  label="Offer a seat automatically"
                  description="A seat that frees up is offered to the person at the front."
                />
                <Field label="Offer expires" htmlFor="cls-waitlist-hours">
                  <span className="ws-suffix-field max-w-[9rem]">
                    <input
                      id="cls-waitlist-hours"
                      className="input"
                      type="number"
                      min={1}
                      value={form.waitlistOfferExpiresHours}
                      onChange={(e) =>
                        onFormChange("waitlistOfferExpiresHours", Number(e.target.value) || 24)
                      }
                    />
                    <span>hours</span>
                  </span>
                </Field>
              </>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Registrants"
          icon={Users}
          className="ws-span-12"
          flush
          actions={
            <>
              <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                {active} active · {registrants.length} total
              </span>
              {occurrences.length > 0 ? (
                <SelectInput
                  className="max-w-[15rem]"
                  aria-label="Filter by session"
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                >
                  <option value="">All sessions</option>
                  {upcoming.map((occ) => (
                    <option key={occ.id} value={occ.id}>
                      {formatSessionRange(occ.startsAt, occ.endsAt)}
                    </option>
                  ))}
                </SelectInput>
              ) : null}
            </>
          }
        >
          {!classSaved ? (
            <p className="px-4 py-8 text-center text-[var(--type-list)] text-[var(--text-secondary)]">
              Save the class to start taking registrations.
            </p>
          ) : visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                {registrants.length === 0 ? "No registrations yet" : "No registrations for this session"}
              </p>
              <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
                Registrations taken on the public page appear here as they arrive.
              </p>
            </div>
          ) : (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Registration</th>
                    <th scope="col">Access / payment</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Attendance</th>
                    <th scope="col" className="ws-cell-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((registrant) => (
                    <tr key={registrant.id}>
                      <td>
                        <button
                          type="button"
                          className="ws-text-btn"
                          onClick={() => setDetail(registrant)}
                        >
                          {registrant.name}
                        </button>
                        <span className="ws-cell-sub">
                          {registrant.email || registrant.phone || "No contact details"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`ws-chip ${
                            registrant.status === "enrolled" ? "ws-chip-success" : "ws-chip-neutral"
                          }`}
                        >
                          {registrant.status === "enrolled" ? "Registered" : registrant.status}
                        </span>
                        <span className="ws-cell-sub">
                          {registrant.occurrenceId
                            ? sessionLabels.get(registrant.occurrenceId) || "Session removed"
                            : "Whole series"}
                        </span>
                      </td>
                      <td>{accessLabel(registrant, form)}</td>
                      <td>{new Date(registrant.createdAt).toLocaleDateString()}</td>
                      <td>
                        <SelectInput
                          aria-label={`Attendance for ${registrant.name}`}
                          className="max-w-[9rem]"
                          value={registrant.attendance || ""}
                          onChange={(e) =>
                            onUpdateRegistration(registrant.id, {
                              attendance: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Not recorded</option>
                          <option value="attended">Attended</option>
                          <option value="no_show">No-show</option>
                          <option value="late_cancel">Late cancel</option>
                        </SelectInput>
                      </td>
                      <td className="ws-cell-actions">
                        {registrant.status === "enrolled" ? (
                          <button
                            type="button"
                            className="ws-text-btn"
                            onClick={() =>
                              onUpdateRegistration(registrant.id, { status: "cancelled" })
                            }
                          >
                            <XCircle className="h-3 w-3" aria-hidden />
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ws-text-btn"
                            onClick={() =>
                              onUpdateRegistration(registrant.id, { status: "enrolled" })
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            Reinstate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {detail ? (
        <Drawer
          title={detail.name}
          description="Registration detail"
          onClose={() => setDetail(null)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
              {detail.status === "enrolled" ? (
                <button
                  type="button"
                  className="appt-pilot-primary-btn"
                  onClick={() => {
                    onUpdateRegistration(detail.id, { attendance: "attended" });
                    setDetail(null);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Mark attended
                </button>
              ) : null}
            </>
          }
        >
          <dl className="ws-detail-list">
            <div>
              <dt>Email</dt>
              <dd>{detail.email || "—"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{detail.phone || "—"}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>
                {detail.occurrenceId
                  ? sessionLabels.get(detail.occurrenceId) || "Session removed"
                  : "Whole series"}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{detail.status === "enrolled" ? "Registered" : detail.status}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{accessLabel(detail, form)}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Attendance</dt>
              <dd>{detail.attendance ? ATTENDANCE_LABEL[detail.attendance] || detail.attendance : "Not recorded"}</dd>
            </div>
          </dl>
          <p className="ws-gap-note mt-4">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Answers to registration questions are not stored against a class registration yet, so
            they are not shown here.{" "}
            <Link href="/appointments/booking/forms" className="ws-text-btn">
              Manage forms
            </Link>
          </p>
        </Drawer>
      ) : null}

      {waitlistOpen ? (
        <Drawer
          title="Waitlist"
          description={`${waitlist.length} waiting · position is arrival order`}
          onClose={() => setWaitlistOpen(false)}
          wide
          footer={
            <button
              type="button"
              className="appt-pilot-outline-btn"
              onClick={() => setWaitlistOpen(false)}
            >
              Close
            </button>
          }
        >
          {upcoming.length > 1 ? (
            <Field label="Offer a seat on" htmlFor="cls-promote-target">
              <SelectInput
                id="cls-promote-target"
                value={promoteTarget || next?.id || ""}
                onChange={(e) => setPromoteTarget(e.target.value)}
              >
                {upcoming.map((occ) => (
                  <option key={occ.id} value={occ.id}>
                    {formatSessionRange(occ.startsAt, occ.endsAt)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}

          <div className="ws-table-wrap mt-3">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col" className="ws-cell-num">
                    #
                  </th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Offer</th>
                  <th scope="col" className="ws-cell-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => (
                  <tr key={entry.id}>
                    <td className="ws-cell-num">{entry.position}</td>
                    <td>
                      {entry.name}
                      <span className="ws-cell-sub">{entry.email || entry.phone || "—"}</span>
                    </td>
                    <td>
                      <span
                        className={`ws-chip ${entry.status === "offered" ? "ws-chip-warning" : "ws-chip-neutral"}`}
                      >
                        {WAITLIST_STATUS_LABEL[entry.status] || entry.status}
                      </span>
                    </td>
                    <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td>
                      {entry.offerExpiresAt
                        ? new Date(entry.offerExpiresAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="ws-cell-actions">
                      <button
                        type="button"
                        className="ws-text-btn"
                        disabled={!next || promoting === entry.id || !entry.contactId}
                        title={
                          !entry.contactId
                            ? "This entry has no linked customer to register"
                            : !next
                              ? "There is no upcoming session to offer"
                              : undefined
                        }
                        onClick={() => void promote(entry.id)}
                      >
                        {promoting === entry.id ? "Offering…" : "Give seat"}
                      </button>
                      <button
                        type="button"
                        className="ws-text-btn"
                        onClick={() => onRemoveWaitlist(entry.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ws-gap-note mt-4">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Giving a seat registers the customer through the same capacity check the public page
            uses, so it fails rather than oversells if the session filled in the meantime.
          </p>
        </Drawer>
      ) : null}
    </div>
  );
}
