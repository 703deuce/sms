import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Copy, Check, MoreHorizontal, Trash2 } from "lucide-react";
import type { TeamBookingPage, SchedulingGroup, BookingTypeLite } from "../types";
import { WORKSPACE_ORIGIN, WORKSPACE_SLUG } from "../types";

export function PageCard({
  page, groups, types, onChange, onBlurSave, onToggleActive, onDelete, showUrl,
}: {
  page: TeamBookingPage;
  groups: SchedulingGroup[];
  types: BookingTypeLite[];
  onChange: (next: TeamBookingPage) => void;
  onBlurSave: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  showUrl: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const url = `${WORKSPACE_ORIGIN}/team/${WORKSPACE_SLUG}/${page.slug}`;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function copy() {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function toggleType(id: string) {
    const has = page.appointmentTypeIds.includes(id);
    onChange({
      ...page,
      appointmentTypeIds: has
        ? page.appointmentTypeIds.filter((t) => t !== id)
        : [...page.appointmentTypeIds, id],
    });
  }

  return (
    <div className="surface" style={{ padding: 18, opacity: page.active ? 1 : 0.75 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="field-grid">
            <div>
              <label className="label" htmlFor={`pname-${page.id}`}>Page name</label>
              <input
                id={`pname-${page.id}`}
                className="input"
                value={page.name}
                onChange={(e) => onChange({ ...page, name: e.target.value })}
                onBlur={onBlurSave}
              />
            </div>
            <div>
              <label className="label" htmlFor={`pslug-${page.id}`}>Slug</label>
              <input
                id={`pslug-${page.id}`}
                className="input"
                value={page.slug}
                onChange={(e) => onChange({ ...page, slug: e.target.value })}
                onBlur={onBlurSave}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 26 }}>
          <span className={`chip ${page.active ? "chip-success" : "chip-muted"}`}>
            {page.active ? "Active" : "Disabled"}
          </span>
          <div className="menu-wrap" ref={menuRef}>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={`More actions for ${page.name}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="menu-pop" role="menu">
                <button
                  className="menu-item danger"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                >
                  <Trash2 size={14} /> Delete page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="field-grid">
        <div>
          <label className="label" htmlFor={`pgroup-${page.id}`}>Scheduling group</label>
          <select
            id={`pgroup-${page.id}`}
            className="input"
            value={page.schedulingGroupId ?? ""}
            onChange={(e) => onChange({ ...page, schedulingGroupId: e.target.value || undefined })}
            onBlur={onBlurSave}
          >
            <option value="">None — individual availability</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.active === false ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`phead-${page.id}`}>Headline — optional</label>
          <input
            id={`phead-${page.id}`}
            className="input"
            value={page.headline ?? ""}
            placeholder="Shown at the top of the public page"
            onChange={(e) => onChange({ ...page, headline: e.target.value })}
            onBlur={onBlurSave}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="label">Booking types offered</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {types.map((t) => {
            const selected = page.appointmentTypeIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.id)}
                onBlur={onBlurSave}
                aria-pressed={selected}
                style={{
                  height: 30, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer",
                  border: selected ? "1px solid var(--primary)" : "1px solid var(--border-strong)",
                  background: selected ? "var(--primary-soft)" : "var(--card)",
                  color: selected ? "var(--primary)" : "var(--fg-muted)",
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
        {page.appointmentTypeIds.length === 0 && (
          <p className="hint" style={{ color: "var(--warning)" }}>
            Select at least one booking type — the public page will not offer times until one is selected.
          </p>
        )}
      </div>

      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {showUrl && (
          <code style={{
            fontSize: 12, background: "var(--muted)", borderRadius: 6,
            padding: "5px 9px", color: "var(--fg-muted)",
            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {url}
          </code>
        )}
        <button className="btn btn-outline btn-sm" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <ExternalLink size={13} /> Preview
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
            {page.active ? "Accepting bookings" : "Not accepting bookings"}
          </span>
          <button
            className="switch"
            role="switch"
            aria-checked={!!page.active}
            aria-label={`Enable ${page.name}`}
            onClick={onToggleActive}
          />
        </div>
      </div>
    </div>
  );
}
