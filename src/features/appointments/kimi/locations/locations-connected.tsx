"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newLocation } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { AppointmentLocation } from "@/lib/appointments/types";
import { defaultWeeklyHours } from "@/lib/appointments/availability-engine-policy";

const LOCATION_KINDS = [
  { value: "office", label: "Office" },
  { value: "store", label: "Store / branch" },
  { value: "customer", label: "Customer location" },
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video" },
  { value: "custom", label: "Custom" },
] as const;

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

type LocationEditorTab = "general" | "hours" | "services" | "staff" | "rooms" | "public";

const LOCATION_TABS: Array<{ id: LocationEditorTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "hours", label: "Hours" },
  { id: "services", label: "Services" },
  { id: "staff", label: "Staff" },
  { id: "rooms", label: "Rooms & Equipment" },
  { id: "public", label: "Public Details" },
];

export function LocationsConnected() {
  const [locations, setLocations] = useState<AppointmentLocation[]>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [typeOptions, setTypeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [resourceOptions, setResourceOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<LocationEditorTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, typesRes, resourcesRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/types"),
        fetch("/api/appointments/service-booking/resources"),
      ]);
      const json = settingsRes.ok ? await settingsRes.json() : { data: {} };
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      const resourcesJson = resourcesRes.ok ? await resourcesRes.json() : { data: [] };
      const list = (json.data?.locations || []) as AppointmentLocation[];
      setLocations(list);
      setStaffOptions((json.data?.staff || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      setTypeOptions(
        (Array.isArray(typesJson.data) ? typesJson.data : []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        })),
      );
      setResourceOptions(
        (Array.isArray(resourcesJson.data) ? resourcesJson.data : []).map(
          (r: { id: string; name: string }) => ({ id: r.id, name: r.name }),
        ),
      );
      setSelectedId((current) => current ?? (list[0]?.id ?? null));
    } catch {
      setError("Could not load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = locations.find((l) => l.id === selectedId) || null;

  function updateSelected(patch: Partial<AppointmentLocation>) {
    if (!selectedId) return;
    setLocations((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)));
  }

  function updateWeeklyHour(day: string, field: "open" | "close", value: string) {
    if (!selected) return;
    const hours = { ...(selected.weeklyHours || defaultWeeklyHours()) };
    const windows = [...(hours[day] || [{ open: "09:00", close: "17:00" }])];
    windows[0] = { ...windows[0], [field]: value };
    hours[day] = windows;
    updateSelected({ weeklyHours: hours });
  }

  function toggleWeeklyHoursOverride(enabled: boolean) {
    if (!selected) return;
    updateSelected({ weeklyHours: enabled ? defaultWeeklyHours() : undefined });
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      return;
    }
    await load();
  }

  function addLocation() {
    const loc = newLocation();
    setLocations((prev) => [...prev, loc]);
    setSelectedId(loc.id);
  }

  function removeLocation(id: string) {
    setLocations((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading locations…</div>;

  return (
    <div className="min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1d29]">Locations</h1>
            <p className="text-[13px] text-[#8a8fa3] mt-1">
              Offices, branches, virtual, and service-area locations for bookings.
            </p>
          </div>
          <Button onClick={addLocation} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add location
          </Button>
        </div>

        <div className="flex gap-5">
          <div className="w-64 shrink-0 space-y-2">
            {locations.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-center text-[13px] text-[#8a8fa3]">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-[#c6c9d6]" />
                No locations yet.
              </div>
            ) : (
              locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`w-full rounded-xl border bg-white p-3 text-left text-[13px] font-medium ${
                    selectedId === l.id ? "ring-2 ring-[#5b4bff]" : ""
                  }`}
                >
                  {l.name || "Unnamed"}
                </button>
              ))
            )}
          </div>

          {selected ? (
            <div className="flex-1 rounded-xl border bg-white">
              <div className="px-6 pt-4 border-b border-[#ecedf2] flex flex-wrap gap-2">
                {LOCATION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                      editorTab === tab.id
                        ? "bg-[#f7f8fb] text-[#1a1d29] ring-1 ring-[#e4e6ee]"
                        : "text-[#8a8fa3]"
                    }`}
                    onClick={() => setEditorTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-6 space-y-4">
              {editorTab === "general" ? (
              <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="location-name">
                    Name
                  </label>
                  <input
                    id="location-name"
                    aria-label="Name"
                    className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Type</label>
                  <select
                    className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                    value={selected.kind || "office"}
                    onChange={(e) => updateSelected({ kind: e.target.value as AppointmentLocation["kind"] })}
                  >
                    {LOCATION_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Address</label>
                <input
                  className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                  value={selected.address || ""}
                  onChange={(e) => updateSelected({ address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Timezone (optional)</label>
                <input
                  className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                  value={selected.timezone || ""}
                  onChange={(e) => updateSelected({ timezone: e.target.value })}
                  placeholder="America/New_York"
                />
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={selected.active !== false}
                  onChange={(e) => updateSelected({ active: e.target.checked })}
                />
                Active
              </label>
              </>
              ) : null}

              {editorTab === "staff" ? (
              <div>
                <p className="text-[13px] text-[#8a8fa3] mb-3">Who works at this location?</p>
                <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Staff at this location</label>
                {staffOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {staffOptions.map((s) => {
                      const checked = (selected.staffIds || []).includes(s.id);
                      return (
                        <label key={s.id} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selected.staffIds || []);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              updateSelected({ staffIds: [...next] });
                            }}
                          />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#8a8fa3]">
                    No staff yet.{" "}
                    <a href="/appointments/staff" className="text-[#5b4bff]">Add staff</a>
                  </p>
                )}
              </div>
              ) : null}

              {editorTab === "services" ? (
              <div>
                <p className="text-[13px] text-[#8a8fa3] mb-3">Which services are offered here?</p>
                <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Services at this location</label>
                {typeOptions.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {typeOptions.map((t) => {
                        const checked = (selected.appointmentTypeIds || []).includes(t.id);
                        return (
                          <label key={t.id} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selected.appointmentTypeIds || []);
                                if (e.target.checked) next.add(t.id);
                                else next.delete(t.id);
                                updateSelected({ appointmentTypeIds: [...next] });
                              }}
                            />
                            {t.name}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a8fa3]">Leave empty to offer all booking types here.</p>
                  </>
                ) : (
                  <p className="text-[12px] text-[#8a8fa3]">No booking types yet.</p>
                )}
              </div>
              ) : null}

              {editorTab === "rooms" ? (
              <div>
                <p className="text-[13px] text-[#8a8fa3] mb-3">What rooms or equipment are available here?</p>
                <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">
                  Rooms & equipment at this location
                </label>
                {resourceOptions.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {resourceOptions.map((r) => {
                        const checked = (selected.resourceIds || []).includes(r.id);
                        return (
                          <label key={r.id} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selected.resourceIds || []);
                                if (e.target.checked) next.add(r.id);
                                else next.delete(r.id);
                                updateSelected({ resourceIds: [...next] });
                              }}
                            />
                            {r.name}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a8fa3]">Leave empty to use all resources here.</p>
                  </>
                ) : (
                  <p className="text-[12px] text-[#8a8fa3]">
                    No rooms or equipment yet.{" "}
                    <a href="/appointments/rooms-equipment" className="text-[#5b4bff]">Add room or equipment</a>
                  </p>
                )}
              </div>
              ) : null}

              {editorTab === "public" ? (
              <div className="space-y-4">
                <p className="text-[13px] text-[#8a8fa3]">Customer-facing details shown on your booking page.</p>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Display address</label>
                  <input
                    className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                    value={selected.address || ""}
                    onChange={(e) => updateSelected({ address: e.target.value })}
                  />
                </div>
                <p className="text-[12px] text-[#8a8fa3]">
                  Directions, parking, and map visibility use the address and location type from General.
                </p>
              </div>
              ) : null}

              {editorTab === "hours" ? (
              <div className="rounded-lg border border-[#eceaf3] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#6b6f82]">Weekly hours</p>
                    <p className="text-[11px] text-[#8a8fa3]">
                      Override platform hours for this location, or inherit defaults.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={Boolean(selected.weeklyHours && Object.keys(selected.weeklyHours).length)}
                      onChange={(e) => toggleWeeklyHoursOverride(e.target.checked)}
                    />
                    Custom hours
                  </label>
                </div>
                {selected.weeklyHours && Object.keys(selected.weeklyHours).length ? (
                  <div className="space-y-2">
                    {WEEKDAYS.map(({ key, label }) => {
                      const window = selected.weeklyHours?.[key]?.[0] || { open: "", close: "" };
                      return (
                        <div key={key} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center text-[12px]">
                          <span className="font-medium text-[#6b6f82]">{label}</span>
                          <input
                            type="time"
                            className="rounded border border-[#e4e6ee] px-2 py-1"
                            value={window.open}
                            onChange={(e) => updateWeeklyHour(key, "open", e.target.value)}
                            aria-label={`${label} open`}
                          />
                          <input
                            type="time"
                            className="rounded border border-[#e4e6ee] px-2 py-1"
                            value={window.close}
                            onChange={(e) => updateWeeklyHour(key, "close", e.target.value)}
                            aria-label={`${label} close`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#8a8fa3]">Using workspace default availability hours.</p>
                )}
              </div>
              ) : null}

              <div className="flex justify-between pt-4 border-t">
                <button
                  type="button"
                  className="text-[13px] text-rose-600 flex items-center gap-1"
                  onClick={() => removeLocation(selected.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
                <div className="flex items-center gap-3">
                  {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
                  <Button onClick={save} disabled={saving} size="sm">
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 rounded-xl border bg-white p-12 text-center text-[13px] text-[#8a8fa3]">
              Select or add a location.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
