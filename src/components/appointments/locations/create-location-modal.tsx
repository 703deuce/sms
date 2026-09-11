"use client";

import { useEffect, useState } from "react";

const KINDS = [
  { value: "office", label: "Physical location" },
  { value: "video", label: "Virtual / online" },
  { value: "customer", label: "At customer location" },
  { value: "phone", label: "Phone" },
] as const;

export function CreateLocationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (locationId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("office");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/appointments/locations/workspace")
      .then((r) => r.json())
      .then((j) => setTypes(j.data?.types || []));
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((j) =>
        setStaff((j.data?.staff || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))),
      );
  }, []);

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          address: kind === "office" || kind === "store" ? address : undefined,
          timezone: timezone || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      const id = json.locationId as string;
      if (typeIds.length || staffIds.length) {
        await fetch(`/api/appointments/locations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentTypeIds: typeIds,
            staffIds,
          }),
        });
      }
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--surface)] p-4 text-xs shadow-lg">
        <div className="flex justify-between">
          <h2 className="text-sm font-semibold">Add location — step {step} of 3</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        {step === 1 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              Name
              <input className="mt-1 w-full rounded border px-2 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              Type
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="appt-pilot-primary-btn" disabled={!name.trim()} onClick={() => setStep(2)}>Next</button>
          </div>
        )}
        {step === 2 && (
          <div className="mt-4 space-y-3">
            {(kind === "office" || kind === "store") && (
              <label className="block">
                Address
                <input className="mt-1 w-full rounded border px-2 py-1.5" value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
            )}
            <label className="block">
              Timezone (optional)
              <input className="mt-1 w-full rounded border px-2 py-1.5" placeholder="America/New_York" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" className="appt-pilot-secondary-btn" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="appt-pilot-primary-btn" onClick={() => setStep(3)}>Next</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="mt-4 space-y-3">
            <p className="text-[var(--text-muted)]">Optional: assign services and staff now.</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeIds.includes(t.id)}
                    onChange={(e) =>
                      setTypeIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))
                    }
                  />
                  {t.name}
                </label>
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={staffIds.includes(s.id)}
                    onChange={(e) =>
                      setStaffIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="appt-pilot-secondary-btn" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void finish()}>
                {saving ? "Creating…" : "Create location"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
