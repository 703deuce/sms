"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newLocation } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { AppointmentLocation } from "@/lib/appointments/types";

const LOCATION_KINDS = [
  { value: "office", label: "Office" },
  { value: "store", label: "Store / branch" },
  { value: "customer", label: "Customer location" },
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video" },
  { value: "custom", label: "Custom" },
] as const;

export function LocationsConnected() {
  const [locations, setLocations] = useState<AppointmentLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/settings");
      const json = res.ok ? await res.json() : { data: {} };
      const list = (json.data?.locations || []) as AppointmentLocation[];
      setLocations(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch {
      setError("Could not load locations");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = locations.find((l) => l.id === selectedId) || null;

  function updateSelected(patch: Partial<AppointmentLocation>) {
    if (!selectedId) return;
    setLocations((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)));
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
            <div className="flex-1 rounded-xl border bg-white p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Name</label>
                  <input
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
