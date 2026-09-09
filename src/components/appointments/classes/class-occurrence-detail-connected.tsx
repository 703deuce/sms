"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Plus,
  UserCheck,
  X,
} from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { labelsForPresentation } from "@/lib/appointments/classes/class-labels";
import {
  PilotInput,
  PilotLabel,
  SectionCard,
} from "@/components/appointments/meetings/meeting-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Contact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Enrollment = {
  id: string;
  contactId: string;
  status: string;
  attendance?: string | null;
  partySize: number;
  contact: Contact | null;
};

type OccurrenceDetail = {
  occurrence: {
    id: string;
    startsAt: string;
    endsAt: string;
    capacity?: number | null;
    status: string;
  };
  series: {
    id: string;
    name: string;
    appointmentTypeId?: string | null;
    staffId?: string | null;
    locationId?: string | null;
  };
  enrollments: Enrollment[];
  enrolledCount: number;
  capacity: number;
  remaining: number;
  classPresentation: string;
};

type CheckInRecord = {
  id: string;
  enrollmentId?: string | null;
  contactId: string;
  status: string;
  checkedInAt?: string | null;
};

type ContactOption = { id: string; name: string };

type Props = {
  occurrenceId: string;
};

function contactName(c: Contact | null): string {
  if (!c) return "Unknown";
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : c.phone || c.email || "Unknown";
}

function formatSessionDate(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const time = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${date} · ${time}`;
}

export function ClassOccurrenceDetailConnected({ occurrenceId }: Props) {
  const [detail, setDetail] = useState<OccurrenceDetail | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [locationNames, setLocationNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [enrolling, setEnrolling] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const presentation = detail?.classPresentation === "workshop_event" ? "workshop_event" : "recurring_class";
  const labels = labelsForPresentation(presentation);
  const isWorkshop = presentation === "workshop_event";
  const listHref = isWorkshop ? "/appointments/types/workshops" : "/appointments/types/classes";
  const editorHref = detail?.series.appointmentTypeId
    ? `${listHref}/${detail.series.appointmentTypeId}`
    : listHref;

  const checkInByEnrollment = useMemo(() => {
    const map = new Map<string, CheckInRecord>();
    for (const row of checkIns) {
      if (row.enrollmentId && row.status === "checked_in") {
        map.set(row.enrollmentId, row);
      }
    }
    return map;
  }, [checkIns]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [detailRes, settingsRes, checkInRes] = await Promise.all([
        fetch(`/api/appointments/service-booking/classes/occurrences/${occurrenceId}`),
        fetch("/api/appointments/settings"),
        fetch(`/api/appointments/service-booking/class-check-in?occurrenceId=${occurrenceId}`),
      ]);
      if (!detailRes.ok) throw new Error("not found");
      const detailJson = await detailRes.json();
      setDetail((detailJson.data || detailJson) as OccurrenceDetail);

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const platform = settingsJson.data?.platform || settingsJson.platform || {};
        const staffMap = new Map<string, string>();
        for (const s of platform.staff || []) {
          if (s.id && s.name) staffMap.set(s.id, s.name);
        }
        setStaffNames(staffMap);
        const locMap = new Map<string, string>();
        for (const l of platform.locations || []) {
          if (l.id && l.name) locMap.set(l.id, l.name);
        }
        setLocationNames(locMap);
      }

      if (checkInRes.ok) {
        const checkInJson = await checkInRes.json();
        setCheckIns((checkInJson.data || checkInJson || []) as CheckInRecord[]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [occurrenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!addOpen || contactQuery.length < 2) {
      setContactOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/contacts?q=${encodeURIComponent(contactQuery)}`)
        .then((r) => r.json())
        .then((json) => {
          const rows = (json.data || json.contacts || json || []) as Array<{
            id: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
            email?: string;
          }>;
          setContactOptions(
            rows.slice(0, 8).map((c) => ({
              id: c.id,
              name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || c.email || c.id,
            })),
          );
        })
        .catch(() => setContactOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [addOpen, contactQuery]);

  const enrollAttendee = useCallback(async () => {
    if (!detail || !selectedContactId) return;
    setEnrolling(true);
    setActionError("");
    try {
      const res = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enroll",
          contactId: selectedContactId,
          occurrenceId: detail.occurrence.id,
          seriesId: detail.series.id,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError(json.error || "Could not enroll — this session may be full.");
        return;
      }
      setAddOpen(false);
      setSelectedContactId("");
      setContactQuery("");
      setPartySize(1);
      await load();
    } finally {
      setEnrolling(false);
    }
  }, [detail, load, selectedContactId]);

  const checkInEnrollment = useCallback(
    async (enrollment: Enrollment) => {
      if (!detail) return;
      const existing = checkInByEnrollment.get(enrollment.id);
      if (existing) {
        setActionError("Already checked in");
        return;
      }
      setCheckInBusy(enrollment.id);
      setActionError("");
      try {
        const createRes = await fetch("/api/appointments/service-booking/class-check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: enrollment.contactId,
            enrollmentId: enrollment.id,
            occurrenceId: detail.occurrence.id,
          }),
        });
        if (!createRes.ok) throw new Error("check-in failed");
        const createJson = await createRes.json();
        const token = (createJson.data?.token || createJson.token) as string;
        const checkRes = await fetch("/api/appointments/service-booking/class-check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_in", token }),
        });
        const checkJson = await checkRes.json();
        const payload = checkJson.data || checkJson;
        if (payload.alreadyCheckedIn) {
          setActionError("Already checked in");
        }
        await load();
      } catch {
        setActionError("Could not check in attendee");
      } finally {
        setCheckInBusy(null);
      }
    },
    [checkInByEnrollment, detail, load],
  );

  const cancelEnrollment = useCallback(
    async (enrollmentId: string) => {
      setActionError("");
      const res = await fetch(`/api/appointments/service-booking/classes/occurrences/${occurrenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_enrollment", enrollmentId }),
      });
      if (!res.ok) {
        setActionError("Could not cancel enrollment");
        return;
      }
      await load();
    },
    [load, occurrenceId],
  );

  const saveOccurrenceEdit = useCallback(async () => {
    if (!detail || !editStart || !editEnd) return;
    setSavingEdit(true);
    setActionError("");
    try {
      const res = await fetch(`/api/appointments/service-booking/classes/occurrences/${occurrenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: new Date(editStart).toISOString(),
          endsAt: new Date(editEnd).toISOString(),
        }),
      });
      if (!res.ok) {
        setActionError("Could not update this session");
        return;
      }
      setEditOpen(false);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }, [detail, editEnd, editStart, load, occurrenceId]);

  const cancelOccurrence = useCallback(async () => {
    if (!detail) return;
    const enrolled = detail.enrollments.filter((e) => e.status === "enrolled").length;
    const ok = window.confirm(
      `Cancel this session? ${enrolled} enrolled ${labels.attendeeNoun.toLowerCase()}${enrolled === 1 ? "" : "s"} will be affected.`,
    );
    if (!ok) return;
    setActionError("");
    const res = await fetch(`/api/appointments/service-booking/classes/occurrences/${occurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      setActionError("Could not cancel session");
      return;
    }
    await load();
  }, [detail, labels.attendeeNoun, load, occurrenceId]);

  if (loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="mt-6 h-96 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (failed || !detail) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Session not found</p>
          <Link href={listHref} className="appt-pilot-muted-link mt-4 inline-block">
            Back to {labels.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const instructor =
    detail.series.staffId ? staffNames.get(detail.series.staffId) || "Assigned" : "—";
  const location =
    detail.series.locationId ? locationNames.get(detail.series.locationId) || "Assigned" : "—";
  const activeEnrollments = detail.enrollments.filter((e) => e.status === "enrolled");
  const isFull = detail.remaining <= 0;
  const isCancelled = detail.occurrence.status === "cancelled";

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href={listHref} className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        {labels.backToList}
      </Link>

      <RefDecoPageHeader
        title={detail.series.name}
        description={formatSessionDate(detail.occurrence.startsAt, detail.occurrence.endsAt)}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={isCancelled || isFull}
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} aria-hidden /> Add {labels.attendeeNoun.toLowerCase()}
            </button>
            <button
              type="button"
              className="appt-pilot-outline-btn"
              onClick={() => {
                const start = new Date(detail.occurrence.startsAt);
                const end = new Date(detail.occurrence.endsAt);
                setEditStart(start.toISOString().slice(0, 16));
                setEditEnd(end.toISOString().slice(0, 16));
                setEditOpen(true);
              }}
            >
              Edit session
            </button>
            {!isCancelled ? (
              <button type="button" className="appt-pilot-outline-btn" onClick={() => void cancelOccurrence()}>
                Cancel session
              </button>
            ) : null}
          </div>
        }
      />

      {actionError ? (
        <p
          className="mb-4 rounded-lg border border-[var(--state-error)] bg-[var(--state-error-soft)] px-3 py-2 appt-pilot-text-list text-[var(--state-error)]"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <SectionCard id="occurrence-overview" title="Overview" description="">
          <dl className="space-y-3 appt-pilot-text-list">
            <div>
              <dt className="appt-pilot-text-helper">{labels.hostLabel}</dt>
              <dd>{instructor}</dd>
            </div>
            <div>
              <dt className="appt-pilot-text-helper">Location</dt>
              <dd>{location}</dd>
            </div>
            <div>
              <dt className="appt-pilot-text-helper">Capacity</dt>
              <dd>
                {detail.enrolledCount} / {detail.capacity}
                {isFull ? " · Full" : ` · ${detail.remaining} spots left`}
              </dd>
            </div>
            <div>
              <dt className="appt-pilot-text-helper">Status</dt>
              <dd className="capitalize">{detail.occurrence.status}</dd>
            </div>
          </dl>
          {detail.series.appointmentTypeId ? (
            <Link href={editorHref} className="appt-pilot-muted-link mt-4 inline-block">
              Edit {labels.itemSingular.toLowerCase()} settings
            </Link>
          ) : null}
        </SectionCard>

        <SectionCard
          id="occurrence-attendees"
          title={labels.attendeesNoun}
          description={`${activeEnrollments.length} ${labels.attendeeNoun.toLowerCase()}${activeEnrollments.length === 1 ? "" : "s"}`}
        >
          {activeEnrollments.length === 0 ? (
            <p className="appt-pilot-text-helper">
              No {labels.attendeesNoun.toLowerCase()} yet. Add someone or share your booking link.
            </p>
          ) : (
            <div className="appt-pilot-data-table-wrap">
              <table className="appt-pilot-data-table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Party</th>
                    <th scope="col">Status</th>
                    <th scope="col">Check-in</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEnrollments.map((enrollment) => {
                    const checkedIn = checkInByEnrollment.has(enrollment.id);
                    const attendance = enrollment.attendance === "present" || checkedIn;
                    return (
                      <tr key={enrollment.id}>
                        <td>{contactName(enrollment.contact)}</td>
                        <td>{enrollment.partySize}</td>
                        <td className="capitalize">{enrollment.status}</td>
                        <td>
                          {attendance ? (
                            <span className="inline-flex items-center gap-1 text-[var(--state-success)]">
                              <Check size={14} aria-hidden /> Checked in
                            </span>
                          ) : (
                            "Not checked in"
                          )}
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="appt-pilot-outline-btn !min-h-8 !px-2"
                              disabled={attendance || checkInBusy === enrollment.id}
                              aria-label={`Check in ${contactName(enrollment.contact)}`}
                              onClick={() => void checkInEnrollment(enrollment)}
                            >
                              <UserCheck size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="appt-pilot-outline-btn !min-h-8 !px-2"
                              aria-label={`Cancel enrollment for ${contactName(enrollment.contact)}`}
                              onClick={() => void cancelEnrollment(enrollment.id)}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-attendee-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 id="add-attendee-title" className="appt-pilot-text-section">
              Add {labels.attendeeNoun.toLowerCase()}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <PilotLabel htmlFor="attendee-search">Search customer</PilotLabel>
                <PilotInput
                  id="attendee-search"
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setSelectedContactId("");
                  }}
                  placeholder="Name, phone, or email"
                  autoFocus
                />
              </div>
              {contactOptions.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)]">
                  {contactOptions.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)] ${
                          selectedContactId === c.id ? "bg-[var(--brand-accent-soft)]" : ""
                        }`}
                        onClick={() => {
                          setSelectedContactId(c.id);
                          setContactQuery(c.name);
                        }}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div>
                <PilotLabel htmlFor="party-size">Party size</PilotLabel>
                <PilotInput
                  id="party-size"
                  type="number"
                  min={1}
                  className="w-24"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!selectedContactId || enrolling}
                onClick={() => void enrollAttendee()}
              >
                {enrolling ? "Enrolling…" : labels.enrollVerb}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-occurrence-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 id="edit-occurrence-title" className="appt-pilot-text-section">Edit this session only</h2>
            <p className="mt-1 appt-pilot-text-helper">
              Changes apply to this {labels.sessionNoun.toLowerCase()} only, not the full series.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <PilotLabel htmlFor="edit-start">Start</PilotLabel>
                <PilotInput
                  id="edit-start"
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div>
                <PilotLabel htmlFor="edit-end">End</PilotLabel>
                <PilotInput
                  id="edit-end"
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={savingEdit}
                onClick={() => void saveOccurrenceEdit()}
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
