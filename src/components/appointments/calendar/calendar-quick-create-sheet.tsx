"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Workspace = {
  staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
};

export type QuickCreatePrefill = {
  startsAt: string;
  staffId?: string;
  locationId?: string;
};

type Props = {
  open: boolean;
  prefill: QuickCreatePrefill | null;
  workspace: Workspace | null;
  onClose: () => void;
  onCreated: () => void;
  onOpenFullForm: (query: URLSearchParams) => void;
};

export function CalendarQuickCreateSheet({
  open,
  prefill,
  workspace,
  onClose,
  onCreated,
  onOpenFullForm,
}: Props) {
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !prefill) return;
    setStartsAt(prefill.startsAt.slice(0, 16));
    setStaffId(prefill.staffId || "");
    setError("");
  }, [open, prefill]);

  if (!open || !prefill) return null;

  const service = workspace?.services.find((s) => s.id === serviceId);

  async function create() {
    if (!phone.trim() || !startsAt) {
      setError("Client phone and time are required.");
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
          startsAt: new Date(startsAt).toISOString(),
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
    if (prefill?.locationId) q.set("locationId", prefill.locationId);
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
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="cal-drawer-body flex flex-col gap-3 text-xs">
          {error ? <p className="text-red-600">{error}</p> : null}
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
