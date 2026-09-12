"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Workspace = {
  staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  locations?: Array<{ id: string; name: string }>;
};

export type QuickCreatePrefill = {
  startsAt: string;
  staffId?: string;
  locationId?: string;
  serviceId?: string;
};

type Props = {
  open: boolean;
  prefill: QuickCreatePrefill | null;
  workspace: Workspace | null;
  onClose: () => void;
  onCreated: () => void;
  onOpenFullForm: (query: URLSearchParams) => void;
  onViewWaitlistMatches?: (slot: { startsAt: string; serviceName?: string }) => void;
};

export function CalendarQuickCreateSheet({
  open,
  prefill,
  workspace,
  onClose,
  onCreated,
  onOpenFullForm,
  onViewWaitlistMatches,
}: Props) {
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [slotWarning, setSlotWarning] = useState("");

  const service = workspace?.services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!open || !prefill) return;
    setStartsAt(prefill.startsAt.slice(0, 16));
    setStaffId(prefill.staffId || "");
    setLocationId(prefill.locationId || "");
    setServiceId(prefill.serviceId || "");
    setError("");
    setSlotWarning("");
  }, [open, prefill]);

  useEffect(() => {
    if (!open || !serviceId) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    const params = new URLSearchParams({
      serviceId,
      daysAhead: "14",
    });
    if (service?.name) params.set("serviceName", service.name);
    if (staffId) params.set("staffId", staffId);
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/appointments/availability?${params}`)
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [open, service?.name, serviceId, staffId, locationId]);

  const nearestSlots = useMemo(() => {
    if (!startsAt || !slots.length) return [];
    const target = new Date(startsAt).getTime();
    return [...slots]
      .sort((a, b) => Math.abs(new Date(a.startsAt).getTime() - target) - Math.abs(new Date(b.startsAt).getTime() - target))
      .slice(0, 5);
  }, [slots, startsAt]);

  useEffect(() => {
    if (!open || !startsAt) return;
    const iso = new Date(startsAt).toISOString();
    const exact = slots.some((s) => s.startsAt === iso);
    if (slots.length && !exact) {
      setSlotWarning("That time is not available in the canonical schedule. Pick a valid slot below.");
    } else {
      setSlotWarning("");
    }
  }, [open, slots, startsAt]);

  useEffect(() => {
    if (!open || !startsAt) return;
    const params = new URLSearchParams({ startsAt: new Date(startsAt).toISOString() });
    if (service?.name) params.set("serviceName", service.name);
    if (serviceId) params.set("serviceId", serviceId);
    if (staffId) params.set("staffId", staffId);
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/appointments/calendar/waitlist-match?${params}`)
      .then((r) => r.json())
      .then((json) => setWaitlistCount(Number(json.data?.count || 0)))
      .catch(() => setWaitlistCount(0));
  }, [open, startsAt, service?.name, serviceId, staffId, locationId]);

  if (!open || !prefill) return null;

  async function create() {
    if (!phone.trim() || !startsAt) {
      setError("Client phone and time are required.");
      return;
    }
    const iso = new Date(startsAt).toISOString();
    if (slots.length && !slots.some((s) => s.startsAt === iso)) {
      setError("Choose a canonically available time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: serviceId || undefined,
          serviceName: service?.name || "Appointment",
          startsAt: iso,
          firstName: firstName.trim() || "Guest",
          lastName: lastName.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
          smsConsent: false,
          source: "admin",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create appointment");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function openFull() {
    const baseStart = startsAt || prefill?.startsAt || new Date().toISOString();
    const q = new URLSearchParams({ startsAt: new Date(baseStart).toISOString() });
    if (staffId) q.set("staffId", staffId);
    if (locationId) q.set("locationId", locationId);
    if (serviceId) q.set("serviceId", serviceId);
    if (phone) q.set("phone", phone);
    onOpenFullForm(q);
  }

  return (
    <div className="cal-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="cal-drawer cal-quick-create"
        role="dialog"
        aria-label="Quick create appointment"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-drawer-head">
          <div>
            <p className="cal-drawer-kicker">Quick create</p>
            <h2 className="cal-drawer-title">New appointment</h2>
            {waitlistCount > 0 ? (
              <button
                type="button"
                className="cal-waitlist-inline-link"
                onClick={() =>
                  onViewWaitlistMatches?.({
                    startsAt: new Date(startsAt || prefill.startsAt).toISOString(),
                    serviceName: service?.name,
                  })
                }
              >
                {waitlistCount} waitlist {waitlistCount === 1 ? "match" : "matches"}
              </button>
            ) : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="cal-drawer-body flex flex-col gap-3 text-xs">
          {error ? <p className="text-red-600">{error}</p> : null}
          {slotWarning ? <p className="text-amber-700">{slotWarning}</p> : null}
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Service</span>
            <select className="rounded border border-[var(--border)] px-2 py-2" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Select service</option>
              {(workspace?.services || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Staff</span>
            <select className="rounded border border-[var(--border)] px-2 py-2" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Any / default</option>
              {(workspace?.staff || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {workspace?.locations?.length ? (
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">Location</span>
              <select className="rounded border border-[var(--border)] px-2 py-2" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Default</option>
                {workspace.locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Canonical slots</span>
            {slotsLoading ? <span className="text-[var(--muted)]">Loading slots…</span> : null}
            <div className="flex flex-wrap gap-1">
              {nearestSlots.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  className="rounded border border-[var(--border)] px-2 py-1"
                  onClick={() => setStartsAt(s.startsAt.slice(0, 16))}
                >
                  {new Date(s.startsAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Start</span>
            <input type="datetime-local" className="rounded border border-[var(--border)] px-2 py-2" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">First name</span>
              <input className="rounded border border-[var(--border)] px-2 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">Last name</span>
              <input className="rounded border border-[var(--border)] px-2 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Phone</span>
            <input className="rounded border border-[var(--border)] px-2 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Notes</span>
            <textarea className="rounded border border-[var(--border)] px-2 py-2 min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="cal-drawer-actions">
          <button type="button" className="appt-pilot-primary-btn w-full" disabled={busy} onClick={() => void create()}>
            Create appointment
          </button>
          <button type="button" className="appt-pilot-secondary-btn w-full" onClick={openFull}>
            Open full booking form
          </button>
        </div>
      </aside>
    </div>
  );
}
