import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { SchedulingGroup } from "../types";

export function AddGroupModal({
  open, saving, onClose, onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (group: SchedulingGroup) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(""); setSlug(""); setError("");
      setTimeout(() => ref.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    if (!name.trim()) { setError("Enter a group name."); return; }
    onCreate({
      id: `sg_${Date.now()}`,
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      memberStaffIds: [],
      roundRobinEnabled: true,
      active: true,
    });
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-group-title">
        <div style={{ display: "flex", alignItems: "center", padding: "18px 20px 0" }}>
          <h2 id="add-group-title" style={{ fontSize: 16, fontWeight: 650, margin: 0, flex: 1 }}>
            New scheduling group
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ padding: "16px 20px 20px", display: "grid", gap: 14 }}>
          <div>
            <label className="label" htmlFor="ng-name">Group name</label>
            <input
              ref={ref}
              id="ng-name"
              className="input"
              placeholder="e.g. Hygiene team"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
          </div>
          <div>
            <label className="label" htmlFor="ng-slug">Slug — optional</label>
            <input
              id="ng-slug"
              className="input"
              placeholder="hygiene-team"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="hint">Used in internal routing. Defaults from the name if left blank.</p>
          </div>
        </div>
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "14px 20px", borderTop: "1px solid var(--border)",
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
