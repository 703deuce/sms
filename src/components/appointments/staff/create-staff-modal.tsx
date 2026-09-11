"use client";

import { useEffect, useState } from "react";

export function CreateStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (staffId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [customerSelectable, setCustomerSelectable] = useState(true);
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((j) => {
        setLocations((j.data?.locations || []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
      });
    void fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((j) => {
        setTypes((j.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      });
  }, []);

  async function submit() {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          publicDisplayName: publicName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          title,
          appointmentTypeIds: typeIds,
          locationIds,
          customerSelectable,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      onCreated(json.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--surface)] p-4 shadow-lg text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add staff — step {step} of 3</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="ws-field-label">Name</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Public display name</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Optional" />
            </label>
            <label className="block">
              <span className="ws-field-label">Email</span>
              <input type="email" className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Phone</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Title / role</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
            <p className="font-medium">Services</p>
            {types.map((t) => (
              <label key={t.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={typeIds.includes(t.id)}
                  onChange={() =>
                    setTypeIds((ids) => (ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id]))
                  }
                />
                {t.name}
              </label>
            ))}
            <p className="mt-4 font-medium">Locations</p>
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={locationIds.includes(l.id)}
                  onChange={() =>
                    setLocationIds((ids) => (ids.includes(l.id) ? ids.filter((x) => x !== l.id) : [...ids, l.id]))
                  }
                />
                {l.name}
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={customerSelectable} onChange={(e) => setCustomerSelectable(e.target.checked)} />
              Show to customers for direct selection (when Service allows)
            </label>
            <p className="text-[var(--text-muted)]">Availability and calendar can be configured after creation.</p>
          </div>
        )}

        {error && <p className="mt-2 text-red-600" role="alert">{error}</p>}

        <div className="mt-4 flex justify-between">
          <button type="button" className="appt-pilot-secondary-btn" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < 3 ? (
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setStep((s) => s + 1)}>Continue</button>
          ) : (
            <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void submit()}>
              {saving ? "Saving…" : "Create staff"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
