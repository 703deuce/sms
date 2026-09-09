"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ResourceGroupRow, SchedulingResourceRow } from "@/lib/appointments/rooms-equipment/resource-display";

type Props = {
  groups: ResourceGroupRow[];
  resources: SchedulingResourceRow[];
  onReload: () => Promise<void>;
};

export function RoomsEquipmentGroupsView({ groups, resources, onReload }: Props) {
  const [name, setName] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeResources = resources.filter((r) => r.active);

  async function saveGroup() {
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    if (selectedResourceIds.length === 0) {
      setError("Add at least one room or equipment to the group");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/service-booking/resource-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId || undefined,
        name: name.trim(),
        resourceIds: selectedResourceIds,
        selectionMode: "any_one",
        active: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save group");
      return;
    }
    setName("");
    setSelectedResourceIds([]);
    setEditingId(null);
    await onReload();
  }

  function startEdit(group: ResourceGroupRow) {
    setEditingId(group.id);
    setName(group.name);
    setSelectedResourceIds(group.resourceIds);
    setError("");
  }

  function toggleMember(id: string) {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1a1d29]">
            {editingId ? "Edit group" : "Create group"}
          </h2>
          <p className="text-[13px] text-[#8a8fa3] mt-1">
            Use any available room or equipment from this group. A service can require the group instead of one specific item.
          </p>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="group-name">
            Group name
          </label>
          <input
            id="group-name"
            className="w-full max-w-md rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Treatment Rooms"
          />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[#6b6f82] mb-2">Members</p>
          {activeResources.length === 0 ? (
            <p className="text-[13px] text-[#8a8fa3]">Add rooms or equipment first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeResources.map((r) => (
                <label
                  key={r.id}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedResourceIds.includes(r.id)}
                    onChange={() => toggleMember(r.id)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          )}
        </div>
        {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={() => void saveGroup()}
          >
            <Plus size={14} /> {saving ? "Saving…" : editingId ? "Save group" : "Create group"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="text-[13px] text-[#6b6f82]"
              onClick={() => {
                setEditingId(null);
                setName("");
                setSelectedResourceIds([]);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-[13px] text-[#8a8fa3] text-center py-8">No groups yet.</p>
      ) : (
        <div className="rounded-xl border bg-white divide-y">
          {groups.map((group) => (
            <div key={group.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[#1a1d29]">{group.name}</p>
                <p className="text-[12px] text-[#8a8fa3] mt-1">
                  {group.resourceIds
                    .map((id) => resources.find((r) => r.id === id)?.name)
                    .filter(Boolean)
                    .join(", ") || "No members"}
                </p>
              </div>
              <button
                type="button"
                className="text-[13px] text-[#5b4bff] font-medium"
                onClick={() => startEdit(group)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
