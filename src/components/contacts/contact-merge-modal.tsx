"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MergePreview = {
  sourceContactId: string;
  targetContactId: string;
  source: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
  target: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
  conflicts: Record<string, { source: string | null; target: string | null }>;
  relatedData: {
    appointments: { source: number; target: number };
    packages: { source: number; target: number };
    memberships: { source: number; target: number };
    notes: { source: number; target: number };
    household: string | null;
  };
};

type ContactOption = { id: string; name: string; email?: string; phone: string };

export function ContactMergeModal({
  primaryContact,
  onClose,
}: {
  primaryContact: { id: string; firstName?: string; lastName?: string; email?: string | null; phone: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [duplicate, setDuplicate] = useState<ContactOption | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [primaryId, setPrimaryId] = useState(primaryContact.id);
  const [chosenValues, setChosenValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryLabel = [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ") || primaryContact.phone;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ take: "12", q });
      void fetch(`/api/contacts?${params}`)
        .then((r) => r.json())
        .then((json) => {
          setOptions(
            (json.data || [])
              .filter((c: { id: string }) => c.id !== primaryContact.id)
              .map((c: { id: string; firstName?: string; lastName?: string; phone: string; email?: string }) => ({
                id: c.id,
                name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
                phone: c.phone,
                email: c.email,
              })),
          );
        })
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, primaryContact.id]);

  async function runPreview() {
    if (!duplicate) return;
    setLoading(true);
    setError(null);
    try {
      const sourceId = duplicate.id;
      const targetId = primaryContact.id;
      const res = await fetch("/api/appointments/service-booking/contact-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceContactId: sourceId, targetContactId: targetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      const data = json.data as MergePreview;
      setPreview(data);
      setPrimaryId(targetId);
      const defaults: Record<string, string> = {};
      for (const [field, vals] of Object.entries(data.conflicts)) {
        defaults[field] = vals.target || vals.source || "";
      }
      setChosenValues(defaults);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function runMerge() {
    if (!preview || !duplicate) return;
    const sourceId = primaryId === primaryContact.id ? duplicate.id : primaryContact.id;
    const targetId = primaryId;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/contact-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          sourceContactId: sourceId,
          targetContactId: targetId,
          chosenValues,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Merge failed");
      onClose();
      router.push(`/contacts/${targetId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,23,42,0.45)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--card, #fff)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="merge-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Merge duplicate contact</h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Combine duplicate records. Related appointments, packages, and memberships move to the surviving contact.
        </p>

        {!preview ? (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Current: </span>
              <strong>{primaryLabel}</strong>
              {primaryContact.email ? ` · ${primaryContact.email}` : ""}
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span>Merge with</span>
              <input
                value={duplicate ? duplicate.name : query}
                onChange={(e) => {
                  setDuplicate(null);
                  setQuery(e.target.value);
                }}
                placeholder="Search contacts"
                style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }}
              />
            </label>
            {!duplicate && options.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", border: "1px solid var(--border)", borderRadius: 8 }}>
                {options.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                      onClick={() => {
                        setDuplicate(opt);
                        setQuery(opt.name);
                        setOptions([]);
                      }}
                    >
                      <strong>{opt.name}</strong>
                      <span style={{ display: "block", color: "var(--muted-foreground)", fontSize: 12 }}>{opt.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {error ? <p style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</p> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ padding: "8px 14px", fontSize: 13 }}>Cancel</button>
              <button
                type="button"
                disabled={!duplicate || loading}
                onClick={() => void runPreview()}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  background: "var(--primary)",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  opacity: !duplicate || loading ? 0.5 : 1,
                }}
              >
                {loading ? "Loading…" : "Compare records"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
              <div>Appointments: {preview.relatedData.appointments.source} + {preview.relatedData.appointments.target}</div>
              <div>Packages: {preview.relatedData.packages.source} + {preview.relatedData.packages.target}</div>
              <div>Memberships: {preview.relatedData.memberships.source} + {preview.relatedData.memberships.target}</div>
              {preview.relatedData.household ? <div>Household: {preview.relatedData.household}</div> : null}
            </div>
            {Object.keys(preview.conflicts).length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Resolve conflicts</p>
                {Object.entries(preview.conflicts).map(([field, vals]) => (
                  <label key={field} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span className="capitalize">{field}</span>
                    <select
                      value={chosenValues[field] || ""}
                      onChange={(e) => setChosenValues((prev) => ({ ...prev, [field]: e.target.value }))}
                      style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }}
                    >
                      {vals.source ? <option value={vals.source}>Source: {vals.source}</option> : null}
                      {vals.target ? <option value={vals.target}>Target: {vals.target}</option> : null}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            <fieldset style={{ border: 0, margin: 0, padding: 0, fontSize: 13 }}>
              <legend style={{ fontWeight: 600, marginBottom: 8 }}>Keep as primary</legend>
              <label style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  type="radio"
                  name="primary"
                  checked={primaryId === primaryContact.id}
                  onChange={() => setPrimaryId(primaryContact.id)}
                />
                {primaryLabel} — {primaryContact.email || primaryContact.phone}
              </label>
              {duplicate ? (
                <label style={{ display: "flex", gap: 8 }}>
                  <input
                    type="radio"
                    name="primary"
                    checked={primaryId === duplicate.id}
                    onChange={() => setPrimaryId(duplicate.id)}
                  />
                  {duplicate.name} — {duplicate.email || duplicate.phone}
                </label>
              ) : null}
            </fieldset>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
              This cannot be easily undone. The non-primary contact will be removed.
            </p>
            {error ? <p style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</p> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPreview(null)} style={{ padding: "8px 14px", fontSize: 13 }}>
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runMerge()}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  background: "#dc2626",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                }}
              >
                {loading ? "Merging…" : "Merge contacts"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
