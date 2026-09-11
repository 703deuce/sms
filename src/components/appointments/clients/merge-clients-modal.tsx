"use client";

import { useState } from "react";

type MergePreview = {
  sourceContactId: string;
  targetContactId: string;
  conflicts: Record<string, { source: string | null; target: string | null }>;
  appointmentCounts: { source: number; target: number };
  packageCounts?: { source: number; target: number };
  membershipCounts?: { source: number; target: number };
  forms?: { source: number; target: number };
  walletCents?: { source: number; target: number };
};

export function MergeClientsModal({
  primaryClientId,
  onClose,
  onMerged,
}: {
  primaryClientId: string;
  onClose: () => void;
  onMerged: (targetId: string) => void;
}) {
  const [duplicateId, setDuplicateId] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [chosenValues, setChosenValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runPreview() {
    if (!duplicateId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          sourceContactId: duplicateId.trim(),
          targetContactId: primaryClientId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      setPreview(json.data as MergePreview);
      const defaults: Record<string, string> = {};
      for (const [field, vals] of Object.entries((json.data as MergePreview).conflicts)) {
        defaults[field] = vals.target || vals.source || "";
      }
      setChosenValues(defaults);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function runMerge() {
    if (!preview) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          sourceContactId: preview.sourceContactId,
          targetContactId: preview.targetContactId,
          chosenValues,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Merge failed");
      onMerged(preview.targetContactId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--surface)] p-4 text-xs shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Merge client records</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <p className="mt-2 text-[var(--text-muted)]">
          Primary record keeps history. The duplicate record will be removed after relationships move.
        </p>

        {!preview && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[var(--text-muted)]">Duplicate client ID (will be merged away)</span>
              <input
                className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5 font-mono"
                value={duplicateId}
                onChange={(e) => setDuplicateId(e.target.value)}
              />
            </label>
            {error && <p className="text-red-600">{error}</p>}
            <button type="button" className="appt-pilot-primary-btn" disabled={loading} onClick={() => void runPreview()}>
              Preview merge
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-4">
            <div className="rounded border border-[var(--border)] p-3">
              <p className="font-medium">Relationships</p>
              <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                <li>Appointments: {preview.appointmentCounts.source} + {preview.appointmentCounts.target}</li>
                {preview.packageCounts && <li>Packages: {preview.packageCounts.source} + {preview.packageCounts.target}</li>}
                {preview.membershipCounts && <li>Memberships: {preview.membershipCounts.source} + {preview.membershipCounts.target}</li>}
                {preview.forms && <li>Forms: {preview.forms.source} + {preview.forms.target}</li>}
                {preview.walletCents && (
                  <li>
                    Wallet credit: ${(preview.walletCents.source / 100).toFixed(2)} + ${(preview.walletCents.target / 100).toFixed(2)}
                  </li>
                )}
              </ul>
            </div>

            {Object.keys(preview.conflicts).length > 0 && (
              <div className="space-y-3">
                <p className="font-medium">Field conflicts</p>
                {Object.entries(preview.conflicts).map(([field, vals]) => (
                  <fieldset key={field} className="rounded border border-[var(--border)] p-2">
                    <legend className="px-1 capitalize">{field}</legend>
                    <label className="mt-1 flex items-center gap-2">
                      <input
                        type="radio"
                        name={field}
                        checked={chosenValues[field] === vals.target}
                        onChange={() => setChosenValues((c) => ({ ...c, [field]: vals.target || "" }))}
                      />
                      Keep primary: {vals.target || "—"}
                    </label>
                    <label className="mt-1 flex items-center gap-2">
                      <input
                        type="radio"
                        name={field}
                        checked={chosenValues[field] === vals.source}
                        onChange={() => setChosenValues((c) => ({ ...c, [field]: vals.source || "" }))}
                      />
                      Use duplicate: {vals.source || "—"}
                    </label>
                  </fieldset>
                ))}
              </div>
            )}

            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="appt-pilot-secondary-btn" onClick={() => setPreview(null)}>Back</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={loading} onClick={() => void runMerge()}>
                Confirm merge
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
