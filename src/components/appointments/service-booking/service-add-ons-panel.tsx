"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ADDONS_API = "/api/appointments/service-booking/add-ons";

export type AddOnRow = {
  id: string;
  name: string;
  description?: string | null;
  priceCents?: number;
  durationDeltaMinutes?: number;
  required?: boolean;
  active?: boolean;
  resourceIds?: string[];
};

type Props = {
  compact?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  resourceOptions?: Array<{ id: string; name: string }>;
};

export function ServiceAddOnsPanel({
  compact = false,
  selectedIds = [],
  onToggleSelect,
  resourceOptions = [],
}: Props) {
  const [addOns, setAddOns] = useState<AddOnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AddOnRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ADDONS_API);
      const json = await res.json();
      setAddOns(json.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setEditing({
      id: "",
      name: "",
      priceCents: 0,
      durationDeltaMinutes: 0,
      required: false,
      active: true,
      resourceIds: [],
    });
    setMessage(null);
  }

  async function save() {
    if (!editing?.name.trim()) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(ADDONS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id || undefined,
        name: editing.name.trim(),
        description: editing.description,
        priceCents: editing.priceCents ?? 0,
        durationDeltaMinutes: editing.durationDeltaMinutes ?? 0,
        required: editing.required ?? false,
        resourceIds: editing.resourceIds || [],
        active: editing.active ?? true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not save add-on");
      return;
    }
    setEditing(null);
    await load();
  }

  if (loading) {
    return <p className="text-[12px] text-[#8a87a0]">Loading add-ons…</p>;
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8a8fa3]">
            Optional extras with price, duration, and room/equipment effects.
          </p>
          <button type="button" className="text-[12px] font-medium text-[#5b4bff] flex items-center gap-1" onClick={startNew}>
            <Plus size={14} /> Add add-on
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="rounded-xl border border-[#ecedf2] p-4 space-y-3 bg-[#faf9fc]">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-medium">Name</span>
            <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-medium">Description</span>
            <input className="input" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Price change ($)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input"
                value={(editing.priceCents ?? 0) / 100}
                onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Duration change (min)</span>
              <input
                type="number"
                className="input"
                value={editing.durationDeltaMinutes ?? 0}
                onChange={(e) => setEditing({ ...editing, durationDeltaMinutes: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          {resourceOptions.length > 0 ? (
            <div>
              <p className="text-[12px] font-medium mb-1">Requires room/equipment</p>
              <div className="flex flex-wrap gap-2">
                {resourceOptions.map((r) => {
                  const on = (editing.resourceIds || []).includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`rounded-full px-2 py-0.5 text-[11px] border ${on ? "bg-[#5b4bff] text-white" : ""}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          resourceIds: on
                            ? (editing.resourceIds || []).filter((id) => id !== r.id)
                            : [...(editing.resourceIds || []), r.id],
                        })
                      }
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={editing.required === true} onChange={(e) => setEditing({ ...editing, required: e.target.checked })} />
            Required when offered
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save add-on"}</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {addOns.length === 0 ? (
          <li className="text-[12.5px] text-[#8a8fa3] text-center py-4 border border-dashed rounded-xl">No add-ons yet.</li>
        ) : (
          addOns.map((addOn) => (
            <li key={addOn.id}>
              {onToggleSelect ? (
                <label
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                    selectedIds.includes(addOn.id) ? "border-[#5b4bff] bg-[#f7f6ff]" : "border-[#ecedf2]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.includes(addOn.id)}
                      onChange={() => onToggleSelect(addOn.id)}
                    />
                    <span className="text-[13px] font-medium">{addOn.name}</span>
                  </span>
                  <span className="text-[11px] text-[#8a8fa3]">
                    {(addOn.priceCents ?? 0) > 0 ? `+$${((addOn.priceCents ?? 0) / 100).toFixed(2)}` : ""}
                    {(addOn.durationDeltaMinutes ?? 0) > 0 ? ` · +${addOn.durationDeltaMinutes} min` : ""}
                  </span>
                </label>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[#ecedf2] px-3.5 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium">{addOn.name}</p>
                    <p className="text-[11px] text-[#8a87a0]">
                      {(addOn.durationDeltaMinutes ?? 0) > 0 ? `+${addOn.durationDeltaMinutes} min · ` : ""}
                      {addOn.active === false ? "Inactive" : "Active"}
                    </p>
                  </div>
                  <button type="button" className="text-[12px] text-[#5b4bff]" onClick={() => setEditing(addOn)}>
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
      {message ? <p className="text-[12px] text-red-700">{message}</p> : null}
    </div>
  );
}
