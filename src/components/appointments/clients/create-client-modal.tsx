"use client";

import { useState } from "react";
type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  matchReason: "email" | "phone" | "both";
};

export function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (clientId: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);

  async function submit(forceCreate = false) {
    setError("");
    if (!phone.trim()) {
      setError("Phone is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          forceCreate,
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.code === "duplicate") {
        setDuplicates((json.duplicates as DuplicateCandidate[]) || []);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Create failed");
      onCreated(json.clientId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="add-client-title">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-[var(--surface)] p-4 shadow-lg text-xs">
        <div className="flex items-center justify-between">
          <h2 id="add-client-title" className="text-sm font-semibold">Add client</h2>
          <button type="button" className="text-[var(--text-muted)]" onClick={onClose}>Close</button>
        </div>

        {duplicates && duplicates.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
            <p className="font-medium">Possible existing client</p>
            <ul className="mt-2 space-y-2">
              {duplicates.map((d) => (
                <li key={d.id} className="rounded border border-amber-100 bg-white p-2">
                  <div className="font-medium">{d.name}</div>
                  <div>{d.email || "—"}</div>
                  <div>{d.phone}</div>
                  <button
                    type="button"
                    className="mt-2 text-[var(--accent)]"
                    onClick={() => onCreated(d.id)}
                  >
                    Use existing
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 appt-pilot-secondary-btn w-full"
              disabled={saving}
              onClick={() => void submit(true)}
            >
              Create separate anyway
            </button>
          </div>
        )}

        {!duplicates?.length && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[var(--text-muted)]">First name</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[var(--text-muted)]">Last name</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[var(--text-muted)]">Email</span>
              <input type="email" className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[var(--text-muted)]">Phone *</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            {error && <p className="text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="appt-pilot-secondary-btn" onClick={onClose}>Cancel</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void submit(false)}>
                {saving ? "Saving…" : "Save client"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
