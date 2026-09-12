"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  appointmentId: string;
  currentStartsAt: string;
  onClose: () => void;
  onDone: () => void;
};

export function CalendarRescheduleSheet({ appointmentId, currentStartsAt, onClose, onDone }: Props) {
  const [startsAt, setStartsAt] = useState(currentStartsAt.slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(startsAt).toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reschedule failed");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cal-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="cal-drawer cal-quick-create" role="dialog" aria-label="Reschedule" onClick={(e) => e.stopPropagation()}>
        <div className="cal-drawer-head">
          <div>
            <p className="cal-drawer-kicker">Reschedule</p>
            <h2 className="cal-drawer-title">Pick a new time</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="cal-drawer-body text-xs">
          {error ? <p className="mb-2 text-red-600">{error}</p> : null}
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">New start</span>
            <input type="datetime-local" className="w-full rounded border border-[var(--border)] px-2 py-2" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Uses the same availability and conflict rules as the full appointment editor.
          </p>
        </div>
        <div className="cal-drawer-actions">
          <button type="button" className="appt-pilot-primary-btn w-full" disabled={busy} onClick={() => void save()}>
            Save new time
          </button>
          <button type="button" className="appt-pilot-secondary-btn w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}
