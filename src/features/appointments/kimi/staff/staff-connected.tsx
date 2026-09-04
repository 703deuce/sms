"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  newStaffMember,
  type PlatformSettingsSnapshot,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import type { BookableStaffMember } from "@/lib/appointments/types";
import { DAY_LABELS } from "@/features/appointments/kimi/availability/map-availability";

function StaffLoading() {
  return <div className="p-8 animate-pulse text-sm text-gray-500">Loading staff…</div>;
}

export function StaffConnected() {
  const [staff, setStaff] = useState<BookableStaffMember[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, typesRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/types"),
      ]);
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      const data = settingsJson.data || {};
      setStaff((data.staff || []) as BookableStaffMember[]);
      setLocations(
        ((data.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
          id: l.id,
          name: l.name,
        })),
      );
      setAppointmentTypes(
        (typesJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
      );
      if ((data.staff || []).length && !selectedId) {
        setSelectedId((data.staff as BookableStaffMember[])[0].id);
      }
    } catch {
      setError("Could not load staff");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = staff.find((s) => s.id === selectedId) || null;

  function updateSelected(patch: Partial<BookableStaffMember>) {
    if (!selectedId) return;
    setStaff((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  function toggleTypeId(typeId: string) {
    if (!selected) return;
    const ids = selected.appointmentTypeIds || [];
    updateSelected({
      appointmentTypeIds: ids.includes(typeId) ? ids.filter((id) => id !== typeId) : [...ids, typeId],
    });
  }

  function toggleLocationId(locId: string) {
    if (!selected) return;
    const ids = selected.locationIds || [];
    updateSelected({
      locationIds: ids.includes(locId) ? ids.filter((id) => id !== locId) : [...ids, locId],
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      return;
    }
    setSaved(true);
    await load();
  }

  function addStaff() {
    const member = newStaffMember();
    setStaff((prev) => [...prev, member]);
    setSelectedId(member.id);
    setSaved(false);
  }

  function removeStaff(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    setSaved(false);
  }

  if (loading) return <StaffLoading />;

  return (
    <div className="reference-root min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1d29]">Team / Staff</h1>
            <p className="text-[13px] text-[#8a8fa3] mt-1">
              Manage bookable staff members, their services, and availability.
            </p>
          </div>
          <Button onClick={addStaff} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add staff
          </Button>
        </div>

        <div className="flex gap-5">
          <div className="w-64 shrink-0 space-y-2">
            {staff.length === 0 ? (
              <div className="card p-6 text-center text-[13px] text-[#8a8fa3]">
                <Users className="h-8 w-8 mx-auto mb-2 text-[#c6c9d6]" />
                No staff yet. Add your first team member.
              </div>
            ) : (
              staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`card w-full p-3 text-left text-[13px] font-medium ${
                    selectedId === s.id ? "ring-2 ring-[#5b4bff]" : ""
                  }`}
                >
                  <span className={s.active === false ? "text-[#8a8fa3] line-through" : ""}>
                    {s.name || "Unnamed"}
                  </span>
                  {s.active === false ? (
                    <span className="ml-2 text-[10px] text-amber-600">Inactive</span>
                  ) : null}
                </button>
              ))
            )}
          </div>

          {selected ? (
            <div className="card flex-1 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input w-full"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.active !== false}
                      onChange={(e) => updateSelected({ active: e.target.checked })}
                    />
                    Active / bookable
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.customerSelectable !== false}
                      onChange={(e) => updateSelected({ customerSelectable: e.target.checked })}
                    />
                    Customer can select
                  </label>
                </div>
              </div>

              {appointmentTypes.length > 0 ? (
                <div>
                  <label className="label">Appointment types</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {appointmentTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-[12px] border ${
                          (selected.appointmentTypeIds || []).includes(t.id)
                            ? "bg-[#5b4bff] text-white border-[#5b4bff]"
                            : "border-[#e4e6ee]"
                        }`}
                        onClick={() => toggleTypeId(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {locations.length > 0 ? (
                <div>
                  <label className="label">Locations</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {locations.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-[12px] border ${
                          (selected.locationIds || []).includes(l.id)
                            ? "bg-[#5b4bff] text-white border-[#5b4bff]"
                            : "border-[#e4e6ee]"
                        }`}
                        onClick={() => toggleLocationId(l.id)}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="label">Weekly availability</label>
                <p className="text-[12px] text-[#8a8fa3] mb-3">
                  Override workspace hours for this staff member. Leave empty to use workspace defaults.
                </p>
                {DAY_LABELS.map(({ key, label }) => {
                  const windows = selected.weeklyHours?.[key] || [];
                  const open = windows.length > 0;
                  return (
                    <div key={key} className="py-2 border-b border-[#ecedf2] text-[13px]">
                      <div className="flex items-center gap-3">
                        <span className="w-24 font-medium">{label}</span>
                        {open ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {windows.map((w, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1">
                                <input
                                  type="time"
                                  className="input text-[12px] py-1"
                                  value={w.open}
                                  onChange={(e) => {
                                    const hours = { ...(selected.weeklyHours || {}) };
                                    const next = [...(hours[key] || [])];
                                    next[idx] = { ...next[idx], open: e.target.value };
                                    updateSelected({ weeklyHours: { ...hours, [key]: next } });
                                  }}
                                />
                                <span>–</span>
                                <input
                                  type="time"
                                  className="input text-[12px] py-1"
                                  value={w.close}
                                  onChange={(e) => {
                                    const hours = { ...(selected.weeklyHours || {}) };
                                    const next = [...(hours[key] || [])];
                                    next[idx] = { ...next[idx], close: e.target.value };
                                    updateSelected({ weeklyHours: { ...hours, [key]: next } });
                                  }}
                                />
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#8a8fa3]">Uses workspace hours</span>
                        )}
                        <button
                          type="button"
                          className="text-[12px] text-[#5b4bff] ml-auto"
                          onClick={() => {
                            const hours = selected.weeklyHours || {};
                            if (open) {
                              updateSelected({ weeklyHours: { ...hours, [key]: [] } });
                            } else {
                              updateSelected({
                                weeklyHours: {
                                  ...hours,
                                  [key]: [{ open: "09:00", close: "17:00" }],
                                },
                              });
                            }
                          }}
                        >
                          {open ? "Clear" : "Set custom"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-[#ecedf2]">
                <button
                  type="button"
                  className="text-[13px] text-rose-600 flex items-center gap-1"
                  onClick={() => removeStaff(selected.id)}
                >
                  <Trash2 size={14} /> Remove staff
                </button>
                <div className="flex items-center gap-3">
                  {saved ? <span className="text-[12px] text-emerald-600">Saved</span> : null}
                  {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
                  <Button onClick={save} disabled={saving} size="sm">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex-1 p-12 text-center text-[13px] text-[#8a8fa3]">
              Select a staff member or add a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
