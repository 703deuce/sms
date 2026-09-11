"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import {
  Drawer,
  Field,
  Modal,
  NumberField,
  Panel,
  SelectInput,
  Switch,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import { capacityBelowRegistered } from "@/lib/appointments/workshops/workshop-form";
import {
  formatSessionDay,
  primarySession,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";
import {
  checkedInCount,
  workshopRegistrationState,
  workshopSeats,
} from "@/lib/appointments/workshops/workshop-summary";
import type {
  WorkshopRegistrant,
  WorkshopWaitlistEntry,
} from "@/features/appointments/kimi/workshops/use-workshop-editor";

type Props = {
  form: WorkshopFormState;
  sessions: WorkshopSessionRow[];
  registrants: WorkshopRegistrant[];
  waitlist: WorkshopWaitlistEntry[];
  saving: boolean;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
  onUpdateRegistration: (
    id: string,
    patch: { status?: string; attendance?: string | null },
  ) => void;
  onSetCheckedIn: (id: string, checkedIn: boolean) => void;
  onPromoteWaitlist: (entryId: string, occurrenceId: string) => Promise<boolean>;
  onRemoveWaitlist: (entryId: string) => void;
};

const STATUS_LABEL: Record<string, string> = {
  enrolled: "Confirmed",
  cancelled: "Cancelled",
  waitlisted: "Waitlisted",
};

const WAITLIST_STATUS_LABEL: Record<string, string> = {
  active: "Waiting",
  offered: "Spot offered",
  converted: "Registered",
  expired: "Offer expired",
  removed: "Removed",
};

const ACCESS_LABEL: Record<string, string> = {
  package: "Package",
  membership: "Membership",
  paid: "Paid",
  free: "Free",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function WorkshopRegistrationSection({
  form,
  sessions,
  registrants,
  waitlist,
  saving,
  onFormChange,
  onUpdateRegistration,
  onSetCheckedIn,
  onPromoteWaitlist,
  onRemoveWaitlist,
}: Props) {
  const [detail, setDetail] = useState<WorkshopRegistrant | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState<number | null>(null);

  const active = useMemo(() => registrants.filter((r) => r.status !== "cancelled"), [registrants]);
  const seats = workshopSeats(form, sessions, active.length);
  const state = workshopRegistrationState(form, sessions, active.length);
  const checkedIn = checkedInCount(registrants);
  const fillPct = seats.capacity > 0 ? Math.min(100, (seats.registered / seats.capacity) * 100) : 0;
  const session = primarySession(sessions);
  const waiting = waitlist.filter((w) => w.status === "active" || w.status === "offered");

  /**
   * Cutting capacity under the number of people already registered would mean
   * the workshop is over capacity the moment it saves, so it is refused here
   * rather than quietly accepted.
   */
  function changeCapacity(next: number) {
    if (capacityBelowRegistered(next, active.length)) {
      setCapacityWarning(next);
      return;
    }
    onFormChange("capacity", next);
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Registration status" icon={CalendarClock} className="ws-span-4">
          <span
            className={`ws-chip ${
              state.tone === "open"
                ? "ws-chip-success"
                : state.tone === "full" || state.tone === "cancelled"
                  ? "ws-chip-warning"
                  : "ws-chip-neutral"
            }`}
          >
            {state.label}
          </span>
          <p className="mt-2 text-[var(--type-list)] text-[var(--text-secondary)]">
            {state.detail}
          </p>
          <dl className="ws-detail-list mt-3.5">
            <div>
              <dt>Workshop date</dt>
              <dd>{session ? formatSessionDay(session.startsAt) : "Not set"}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{seats.registered}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd>{registrants.length - active.length}</dd>
            </div>
            {form.admissionEnabled ? (
              <div>
                <dt>Checked in</dt>
                <dd>
                  {checkedIn} of {seats.registered}
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>

        <Panel title="Capacity" icon={Ticket} className="ws-span-4">
          <Field
            label="Maximum registrations"
            htmlFor="wks-capacity"
            hint="Enforced by the server when someone registers."
          >
            <NumberField
              id="wks-capacity"
              suffix="spots"
              min={1}
              value={form.capacity}
              onChange={(e) => changeCapacity(Number(e.target.value) || 1)}
            />
          </Field>
          <div className="ws-stat mt-3">
            <span className="ws-stat-value">{seats.registered}</span>
            <span className="ws-stat-unit">of {seats.capacity} registered</span>
          </div>
          <div className={`ws-meter${seats.remaining === 0 ? " is-full" : ""}`}>
            <span style={{ width: `${fillPct}%` }} />
          </div>
          <p className="ws-stat-note">
            {seats.remaining > 0 ? `${seats.remaining} spots left.` : "This workshop is full."}
          </p>
          <div className="mt-3">
            <Switch
              checked={form.showRemainingSpots}
              onChange={(v) => onFormChange("showRemainingSpots", v)}
              label="Show spots publicly"
              description="The registration page displays how many places are left."
            />
          </div>
        </Panel>

        <Panel title="Registration window" icon={CalendarClock} className="ws-span-4">
          <Field
            label="Opens"
            htmlFor="wks-reg-opens"
            hint="Leave blank to open immediately."
          >
            <TextInput
              id="wks-reg-opens"
              type="datetime-local"
              value={form.registrationOpensAt}
              onChange={(e) => onFormChange("registrationOpensAt", e.target.value)}
            />
          </Field>
          <div className="mt-3.5">
            <Field
              label="Closes"
              htmlFor="wks-reg-closes"
              hint="Leave blank to stay open until the workshop starts."
            >
              <TextInput
                id="wks-reg-closes"
                type="datetime-local"
                value={form.registrationClosesAt}
                onChange={(e) => onFormChange("registrationClosesAt", e.target.value)}
              />
            </Field>
          </div>
          <p className="ws-field-hint mt-2.5">
            Checked when someone registers, not only when the page is loaded.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Registrants"
          icon={Users}
          className="ws-span-12"
          flush
          actions={
            <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
              {active.length} active · {registrants.length} total
            </span>
          }
        >
          {registrants.length === 0 ? (
            <div className="ws-empty-inline" style={{ margin: "0.875rem" }}>
              <span className="ws-empty-inline-icon">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                  No registrations yet
                </p>
                <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Customers will appear here after registering.
                </p>
              </div>
            </div>
          ) : (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <caption className="sr-only">Everyone registered for this workshop</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col">Access / payment</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Check-in</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrants.map((r) => {
                    const isCheckedIn = r.attendance === "attended";
                    return (
                      <tr key={r.id}>
                        <th scope="row">
                          <button
                            type="button"
                            className="ws-text-btn"
                            onClick={() => setDetail(r)}
                          >
                            {r.name}
                          </button>
                          <span className="ws-cell-sub">{r.email || r.phone || "No contact"}</span>
                        </th>
                        <td>
                          <span
                            className={`ws-chip ${
                              r.status === "enrolled" ? "ws-chip-success" : "ws-chip-neutral"
                            }`}
                          >
                            {STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                        <td>{r.access ? ACCESS_LABEL[r.access] || r.access : "Due on arrival"}</td>
                        <td>{formatDate(r.createdAt)}</td>
                        <td>
                          {r.status === "cancelled" ? (
                            <span className="text-[var(--text-tertiary)]">—</span>
                          ) : (
                            <button
                              type="button"
                              className={`ws-checkin-btn${isCheckedIn ? " is-on" : ""}`}
                              aria-pressed={isCheckedIn}
                              onClick={() => onSetCheckedIn(r.id, !isCheckedIn)}
                            >
                              {isCheckedIn ? (
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <Circle className="h-3.5 w-3.5" aria-hidden />
                              )}
                              {isCheckedIn ? "Checked in" : "Check in"}
                            </button>
                          )}
                        </td>
                        <td className="ws-cell-actions">
                          <button
                            type="button"
                            className="ws-text-btn"
                            onClick={() => setDetail(r)}
                          >
                            Details
                          </button>
                          {r.status === "enrolled" ? (
                            <button
                              type="button"
                              className="ws-text-btn is-danger"
                              onClick={() => onUpdateRegistration(r.id, { status: "cancelled" })}
                            >
                              Cancel
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ws-text-btn"
                              onClick={() => onUpdateRegistration(r.id, { status: "enrolled" })}
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Waitlist"
          icon={ClipboardList}
          className="ws-span-12"
          actions={
            <button
              type="button"
              className="ws-text-btn"
              onClick={() => setWaitlistOpen(true)}
              disabled={waitlist.length === 0}
            >
              Manage
            </button>
          }
        >
          <div className="ws-inline-metrics">
            <div>
              <p className="ws-summary-row-label">Waitlist</p>
              <p className="ws-row-primary">{form.waitlistEnabled ? "Enabled" : "Off"}</p>
            </div>
            <div>
              <p className="ws-summary-row-label">Waiting</p>
              <p className="ws-row-primary">{waiting.length}</p>
            </div>
            <div>
              <p className="ws-summary-row-label">Promotion</p>
              <p className="ws-row-primary">
                {form.waitlistAutoPromote ? "Automatic" : "By hand"}
              </p>
            </div>
            <div>
              <p className="ws-summary-row-label">Offer expires</p>
              <p className="ws-row-primary">{form.waitlistOfferExpiresHours} hours</p>
            </div>
          </div>

          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
            <Switch
              checked={form.waitlistEnabled}
              onChange={(v) => onFormChange("waitlistEnabled", v)}
              label="Take a waitlist when full"
              description="A full workshop offers the waitlist instead of turning people away."
            />
            <Switch
              checked={form.waitlistAutoPromote}
              onChange={(v) => onFormChange("waitlistAutoPromote", v)}
              label="Offer a spot automatically"
              description="A spot that frees up is offered to the person at the front."
            />
            <Field label="Offer expires after" htmlFor="wks-waitlist-hours">
              <NumberField
                id="wks-waitlist-hours"
                suffix="hours"
                min={1}
                value={form.waitlistOfferExpiresHours}
                onChange={(e) =>
                  onFormChange("waitlistOfferExpiresHours", Number(e.target.value) || 24)
                }
              />
            </Field>
          </div>

          {form.waitlistAutoPromote ? (
            <p className="ws-gap-note mt-3">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              <span>
                Automatic promotion is recorded on the workshop, but no scheduled job runs it yet.
                Give the spot from Manage and the same capacity check applies.
              </span>
            </p>
          ) : null}
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
                    onUpdateRegistration(detail.id, { status: "cancelled" });
                    setDetail(null);
                  }}
                >
                  Cancel registration
                </button>
              ) : null}
            </>
          }
        >
          <dl className="ws-detail-list">
            <div>
              <dt>Status</dt>
              <dd>{STATUS_LABEL[detail.status] || detail.status}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{detail.email || "Not given"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{detail.phone || "Not given"}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
            </div>
            <div>
              <dt>Access / payment</dt>
              <dd>
                {detail.access ? ACCESS_LABEL[detail.access] || detail.access : "Due on arrival"}
              </dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>{detail.attendance === "attended" ? "Checked in" : "Not checked in"}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <Field label="Registration status" htmlFor="wks-detail-status">
              <SelectInput
                id="wks-detail-status"
                value={detail.status}
                onChange={(e) => {
                  onUpdateRegistration(detail.id, { status: e.target.value });
                  setDetail({ ...detail, status: e.target.value });
                }}
              >
                <option value="enrolled">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </SelectInput>
            </Field>
          </div>

          <p className="ws-gap-note mt-4">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {/* The note lays its children out as flex items, so the sentence and
                the link have to arrive as one child or they sit side by side. */}
            <span>
              Answers to registration questions are not stored against a workshop registration yet,
              so they are not shown here.{" "}
              <Link href="/appointments/booking/forms" className="ws-text-btn">
                Manage forms
              </Link>
            </span>
          </p>
        </Drawer>
      ) : null}

      {waitlistOpen ? (
        <Drawer
          title="Waitlist"
          description="In the order people joined. Giving a spot registers them and runs the same capacity check."
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
          <div className="ws-table-wrap">
            <table className="ws-table">
              <caption className="sr-only">Everyone waiting for a spot</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Offer</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => (
                  <tr key={entry.id}>
                    <td className="ws-cell-num">{entry.position}</td>
                    <th scope="row">
                      {entry.name}
                      <span className="ws-cell-sub">
                        {entry.email || entry.phone || "No contact"}
                      </span>
                    </th>
                    <td>
                      <span className="ws-chip ws-chip-neutral">
                        {WAITLIST_STATUS_LABEL[entry.status] || entry.status}
                      </span>
                    </td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{entry.offerExpiresAt ? formatDate(entry.offerExpiresAt) : "—"}</td>
                    <td className="ws-cell-actions">
                      <button
                        type="button"
                        className="ws-text-btn"
                        disabled={saving || !session}
                        onClick={() => {
                          if (session) void onPromoteWaitlist(entry.id, session.id);
                        }}
                      >
                        Give spot
                      </button>
                      <button
                        type="button"
                        className="ws-text-btn is-danger"
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
          {!session ? (
            <p className="ws-gap-note mt-3.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              <span>
                Set a date for this workshop before giving anybody a spot — a registration has to
                attach to a session.
              </span>
            </p>
          ) : null}
        </Drawer>
      ) : null}

      {capacityWarning !== null ? (
        <Modal
          title="Capacity is below the number registered"
          onClose={() => setCapacityWarning(null)}
          footer={
            <button
              type="button"
              className="appt-pilot-primary-btn"
              onClick={() => setCapacityWarning(null)}
            >
              Got it
            </button>
          }
        >
          <p className="flex items-start gap-2 text-[var(--type-list)] text-[var(--text-secondary)]">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--state-warning)]"
              aria-hidden
            />
            <span>
              {active.length} {active.length === 1 ? "person is" : "people are"} already registered,
              so capacity cannot be set to {capacityWarning}. Cancel a registration first, or leave
              capacity at {form.capacity}.
            </span>
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
