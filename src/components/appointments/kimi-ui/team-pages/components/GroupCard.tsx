import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { SchedulingGroup, StaffLite } from "../types";

export function GroupCard({
  group, staff, onChange, onBlurSave, onToggleRoundRobin, onToggleActive, onDelete,
}: {
  group: SchedulingGroup;
  staff: StaffLite[];
  onChange: (next: SchedulingGroup) => void;
  onBlurSave: () => void;
  onToggleRoundRobin: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const members = group.memberStaffIds
    .map((id) => staff.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  function toggleMember(id: string) {
    const has = group.memberStaffIds.includes(id);
    onChange({
      ...group,
      memberStaffIds: has
        ? group.memberStaffIds.filter((m) => m !== id)
        : [...group.memberStaffIds, id],
    });
  }

  return (
    <div className="surface" style={{ padding: 18, opacity: group.active === false ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }} className="group-top">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 14 }}>
            <div>
              <label className="label" htmlFor={`gname-${group.id}`}>Group name</label>
              <input
                id={`gname-${group.id}`}
                className="input"
                value={group.name}
                onChange={(e) => onChange({ ...group, name: e.target.value })}
                onBlur={onBlurSave}
              />
            </div>
            <div>
              <label className="label" htmlFor={`gslug-${group.id}`}>Slug</label>
              <input
                id={`gslug-${group.id}`}
                className="input"
                value={group.slug}
                onChange={(e) => onChange({ ...group, slug: e.target.value })}
                onBlur={onBlurSave}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 26 }}>
          <span className={`chip ${group.active === false ? "chip-muted" : "chip-success"}`}>
            {group.active === false ? "Inactive" : "Active"}
          </span>
          <div className="menu-wrap" ref={menuRef}>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={`More actions for ${group.name}`}
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
                  <Trash2 size={14} /> Delete group
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="label">Members</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {staff.map((s) => {
            const selected = group.memberStaffIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleMember(s.id)}
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
                {s.name}
              </button>
            );
          })}
        </div>
        <p className="hint">
          {members.length > 0 ? members.join(" · ") : "No members selected — select at least one member."}
        </p>
      </div>

      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          className="switch"
          role="switch"
          aria-checked={!!group.roundRobinEnabled}
          aria-label="Round-robin distribution"
          onClick={onToggleRoundRobin}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Round-robin distribution</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            New bookings rotate evenly across group members.
          </div>
        </div>
        <span className={`chip ${group.roundRobinEnabled ? "chip-success" : "chip-muted"}`} style={{ marginLeft: "auto" }}>
          {group.roundRobinEnabled ? "On" : "Off"}
        </span>
      </div>

      <div style={{
        marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Group status</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {group.active === false
              ? "Inactive groups can't be attached to new team pages."
              : "Available to attach to team booking pages."}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
          {group.active === false ? "Inactive" : "Active"}
        </span>
        <button
          className="switch"
          role="switch"
          aria-checked={group.active !== false}
          aria-label={`Enable ${group.name}`}
          onClick={onToggleActive}
        />
      </div>

      <style>{`@media (max-width: 640px){ .group-top > div { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
