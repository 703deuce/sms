"use client";

import { useState } from "react";
import { X } from "lucide-react";

const TYPES = ["Room", "Equipment", "Vehicle", "Station", "Court", "Bay", "Pool", "Custom"];

type Props = {
  onClose: () => void;
  onCreated: (resourceId: string) => void;
  locations: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  defaultLocationIds?: string[];
};

export function CreateResourceModal({
  onClose,
  onCreated,
  locations,
  services,
  defaultLocationIds,
}: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Room");
  const [description, setDescription] = useState("");
  const [locationIds, setLocationIds] = useState<string[]>(defaultLocationIds || []);
  const [quantity, setQuantity] = useState(1);
  const [poolMode, setPoolMode] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleService(id: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const res = await fetch("/api/appointments/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: poolMode ? `${category} pool` : category,
          description: description || undefined,
          quantity: qty,
          locationIds: locationIds.length ? locationIds : undefined,
          eligibleTypeIds: [...selectedServices],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      onCreated(json.resourceId as string);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="create-resource-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="create-resource-title" className="text-sm font-semibold">
            Add resource — step {step} of 3
          </h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="px-4 pt-2 text-xs text-red-600">{error}</p>}

        {step === 1 && (
          <div className="space-y-3 p-4 text-xs">
            <label className="block">
              Resource name
              <input
                className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Treatment Room 1"
              />
            </label>
            <label className="block">
              Type / category
              <select
                className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Internal note
              <textarea
                className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 p-4 text-xs">
            {locations.length > 0 && (
              <div>
                <p className="font-medium">Location</p>
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {locations.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={locationIds.includes(loc.id)}
                        onChange={() =>
                          setLocationIds((ids) =>
                            ids.includes(loc.id) ? ids.filter((x) => x !== loc.id) : [...ids, loc.id],
                          )
                        }
                      />
                      {loc.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={poolMode} onChange={(e) => setPoolMode(e.target.checked)} />
              Quantity pool (interchangeable units)
            </label>
            <label className="block">
              {poolMode ? "Quantity" : "Capacity"}
              <input
                type="number"
                min={1}
                step={1}
                className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="p-4 text-xs">
            <p className="mb-2 text-[var(--text-muted)]">Assign services that require this resource.</p>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-[var(--border)] p-2">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedServices.has(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              {!services.length && <p className="text-[var(--text-muted)]">No services yet.</p>}
            </div>
          </div>
        )}

        <div className="flex justify-between border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            className="text-xs text-[var(--text-muted)]"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="appt-pilot-primary-btn text-xs"
              disabled={step === 1 && !name.trim()}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="appt-pilot-primary-btn text-xs"
              disabled={saving || !name.trim()}
              onClick={() => void submit()}
            >
              {saving ? "Saving…" : "Create resource"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
