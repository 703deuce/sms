"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RESOURCES_API = "/api/appointments/service-booking/resources";

type LocationOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (resource: { id: string; name: string; quantity?: number }) => void;
  locations?: LocationOption[];
  defaultLocationId?: string;
};

export function ServiceResourceQuickCreate({ open, onClose, onCreated, locations = [], defaultLocationId }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"room" | "equipment" | "other">("room");
  const [locationId, setLocationId] = useState(defaultLocationId || "");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(RESOURCES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        quantity,
        active: true,
        metadata: locationId ? { locationIds: [locationId], resourceType: type } : { resourceType: type },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not create item.");
      return;
    }
    const json = await res.json();
    const row = json.data as { id: string; name: string; quantity?: number };
    onCreated(row);
    setName("");
    setQuantity(1);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="resource-quick-create-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="resource-quick-create-title" className="text-[15px] font-bold">Add room or equipment</h2>
          <button type="button" onClick={onClose} className="text-[#8a87a0] hover:text-[#1a1830]">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-medium">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Treatment Room, Camera Kit…" />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium mb-1">Type</legend>
            {(["room", "equipment", "other"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-[13px] capitalize">
                <input type="radio" name="resource-type" checked={type === t} onChange={() => setType(t)} />
                {t === "other" ? "Other" : t}
              </label>
            ))}
          </fieldset>
          {locations.length > 0 ? (
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium">Location</span>
              <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Select location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-medium">How many are available?</span>
            <input type="number" className="input max-w-[120px]" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
            <span className="text-[11px] text-[#8a87a0]">
              Transovo can schedule up to {quantity} appointments at the same time when each needs one.
            </span>
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="border-t px-5 py-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
