import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { TeamBookingPage, SchedulingGroup, BookingTypeLite } from "../mock-data";

export function AddPageModal({
  open, saving, groups, types, onClose, onCreate,
}: {
  open: boolean;
  saving: boolean;
  groups: SchedulingGroup[];
  types: BookingTypeLite[];
  onClose: () => void;
  onCreate: (page: TeamBookingPage) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [groupId, setGroupId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(""); setSlug(""); setGroupId(""); setTypeId(types[0]?.id ?? ""); setError("");
      setTimeout(() => ref.current?.focus(), 30);
    }
  }, [open, types]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    if (!name.trim()) { setError("Enter a page name."); return; }
    if (!typeId) { setError("Select a booking type to offer on this page."); return; }
    onCreate({
      id: `tp_${Date.now()}`,
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      schedulingGroupId: groupId || undefined,
      appointmentTypeIds: [typeId],
      active: true,
    });
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-page-title">
        <div style={{ display: "flex", alignItems: "center", padding: "18px 20px 0" }}>
          <h2 id="add-page-title" style={{ fontSize: 16, fontWeight: 650, margin: 0, flex: 1 }}>
            New team booking page
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ padding: "16px 20px 20px", display: "grid", gap: 14 }}>
          <div>
            <label className="label" htmlFor="np-name">Page name</label>
            <input
              ref={ref}
              id="np-name"
              className="input"
              placeholder="e.g. Consultations (all providers)"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
            />
            {error && name.trim() === "" && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
          </div>
          <div>
            <label className="label" htmlFor="np-slug">Slug — optional</label>
            <input
              id="np-slug"
              className="input"
              placeholder="consultations"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="hint">Forms the public URL: /team/{`{workspace}`}/{slug || "slug"}</p>
          </div>
          <div>
            <label className="label" htmlFor="np-type">Booking type</label>
            <select id="np-type" className="input" value={typeId} onChange={(e) => { setTypeId(e.target.value); setError(""); }}>
              <option value="">Select a booking type</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.durationMinutes} min</option>)}
            </select>
            {error && !typeId && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
          </div>
          <div>
            <label className="label" htmlFor="np-group">Scheduling group — optional</label>
            <select id="np-group" className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">None — individual availability</option>
              {groups.filter((g) => g.active !== false).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "14px 20px", borderTop: "1px solid var(--border)",
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create page"}
          </button>
        </div>
      </div>
    </div>
  );
}
