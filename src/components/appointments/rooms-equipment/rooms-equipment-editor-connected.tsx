"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  ROOM_EQUIPMENT_KINDS,
  resourceKind,
  resourceLocationIds,
  type RoomEquipmentKind,
  type SchedulingResourceRow,
} from "@/lib/appointments/rooms-equipment/resource-display";

type Props = {
  resourceId: string | null;
};

export function RoomsEquipmentEditorConnected({ resourceId }: Props) {
  const router = useRouter();
  const isNew = !resourceId;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RoomEquipmentKind>("room");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [active, setActive] = useState(true);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (isNew) {
      const settingsRes = await fetch("/api/appointments/settings");
      if (settingsRes.ok) {
        const json = await settingsRes.json();
        setLocations(
          ((json.data?.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
            id: l.id,
            name: l.name,
          })),
        );
      }
      return;
    }
    setLoading(true);
    try {
      const [resRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/service-booking/resources"),
        fetch("/api/appointments/settings"),
      ]);
      const resJson = await resRes.json();
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      const rows = (resJson.data || resJson || []) as SchedulingResourceRow[];
      const row = rows.find((r) => r.id === resourceId);
      if (!row) {
        setError("Room or equipment not found");
        return;
      }
      setName(row.name);
      setKind(resourceKind(row));
      setDescription(row.description || "");
      setQuantity(row.quantity);
      setActive(row.active);
      setLocationIds(resourceLocationIds(row));
      setLocations(
        ((settingsJson.data?.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
          id: l.id,
          name: l.name,
        })),
      );
    } catch {
      setError("Could not load");
    } finally {
      setLoading(false);
    }
  }, [isNew, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/service-booking/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resourceId || undefined,
        name: name.trim(),
        quantity: Math.max(1, quantity),
        description: description.trim() || undefined,
        active,
        locationIds,
        kind,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      return;
    }
    const json = await res.json();
    const saved = json.data || json;
    router.push(`/appointments/rooms-equipment/${saved.id}`);
  }

  function toggleLocation(id: string) {
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/appointments/rooms-equipment"
          className="inline-flex items-center gap-1 text-[13px] text-[#5b4bff] font-medium mb-4"
        >
          <ArrowLeft size={14} /> Rooms & Equipment
        </Link>
        <h1 className="text-[24px] font-bold text-[#1a1d29] mb-6">
          {isNew ? "Add room or equipment" : "Edit room or equipment"}
        </h1>

        <div className="rounded-xl border bg-white p-6 space-y-6">
          <section className="space-y-4">
            <h2 className="text-[13px] font-semibold text-[#6b6f82] uppercase tracking-wide">General</h2>
            <div>
              <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="re-name">Name</label>
              <input
                id="re-name"
                className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="re-type">Type</label>
              <select
                id="re-type"
                className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                value={kind}
                onChange={(e) => setKind(e.target.value as RoomEquipmentKind)}
              >
                {ROOM_EQUIPMENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="re-desc">
                Description <span className="font-normal text-[#8a8fa3]">(optional)</span>
              </label>
              <textarea
                id="re-desc"
                className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px] min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="text-[13px] font-semibold text-[#6b6f82] uppercase tracking-wide">Location</h2>
            <p className="text-[12px] text-[#8a8fa3]">Assign where this room or equipment is available.</p>
            {locations.length === 0 ? (
              <p className="text-[13px] text-[#8a8fa3]">
                No locations yet.{" "}
                <Link href="/appointments/locations" className="text-[#5b4bff]">Add a location</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <label key={loc.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px]">
                    <input
                      type="checkbox"
                      checked={locationIds.includes(loc.id)}
                      onChange={() => toggleLocation(loc.id)}
                    />
                    {loc.name}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="text-[13px] font-semibold text-[#6b6f82] uppercase tracking-wide">Capacity</h2>
            <div>
              <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="re-qty">
                How many identical units are available?
              </label>
              <input
                id="re-qty"
                type="number"
                min={1}
                className="w-24 rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="text-[11px] text-[#8a8fa3] mt-1">
                Example: three massage rooms means three appointments can use one room each at the same time.
              </p>
            </div>
          </section>

          {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/appointments/rooms-equipment"
              className="rounded-lg border px-4 py-2 text-[13px] font-medium"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              className="rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
