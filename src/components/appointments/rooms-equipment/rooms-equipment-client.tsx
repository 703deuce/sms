"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
const RESOURCES_API = "/api/appointments/service-booking/resources";
const GROUPS_API = "/api/appointments/service-booking/resource-groups";

type ResourceRow = {
  id: string;
  name: string;
  quantity?: number;
  description?: string | null;
  active?: boolean;
  eligibleTypeIds?: string[];
  metadata?: { locationIds?: string[] } | null;
};

type GroupRow = {
  id: string;
  name: string;
  resourceIds: string[];
  selectionMode?: "any_one" | "all_required";
  active?: boolean;
};

type Tab = "items" | "groups";

function resourceTypeLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("room")) return "Room";
  if (lower.includes("equipment") || lower.includes("table") || lower.includes("chair")) return "Equipment";
  return "Other";
}

export function RoomsEquipmentClient() {
  const [tab, setTab] = useState<Tab>("items");
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resRes, grpRes] = await Promise.all([
        fetch(RESOURCES_API),
        fetch(GROUPS_API),
      ]);
      const resJson = await resRes.json();
      const grpJson = await grpRes.json();
      setResources(resJson.data || []);
      setGroups(grpJson.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createResource() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(RESOURCES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quantity: newQty, active: true }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not create item");
      return;
    }
    setNewName("");
    setNewQty(1);
    await load();
  }

  async function saveResource(row: ResourceRow, quantity: number) {
    setSaving(true);
    const res = await fetch(RESOURCES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        quantity,
        active: row.active ?? true,
        description: row.description,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Save failed");
      return;
    }
    await load();
  }

  async function saveGroup() {
    const name = groupName.trim();
    if (!name || groupMemberIds.length === 0) {
      setMessage("Enter a group name and select at least one item.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(GROUPS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingGroupId || undefined,
        name,
        resourceIds: groupMemberIds,
        selectionMode: "any_one",
        active: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not save group");
      return;
    }
    setGroupName("");
    setGroupMemberIds([]);
    setEditingGroupId(null);
    await load();
  }

  function startEditGroup(g: GroupRow) {
    setEditingGroupId(g.id);
    setGroupName(g.name);
    setGroupMemberIds(g.resourceIds || []);
    setTab("groups");
  }

  if (loading) {
    return (
      <div className="avail-page min-h-full bg-[#f7f6fb] p-8">
        <div className="max-w-[1280px] mx-auto animate-pulse h-48 rounded-xl bg-white border" />
      </div>
    );
  }

  return (
    <div className="avail-page min-h-full bg-[#f7f6fb] font-sans">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">
        <header className="mb-6">
          <h1 className="text-[22px] font-bold text-[#1a1830]">Rooms & Equipment</h1>
          <p className="text-[13px] text-[#8a87a0] mt-1">
            Manage bookable rooms, equipment, and groups. Assign items from Service editors or here.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Rooms sections">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium border ${
              tab === "items"
                ? "border-[#5b4bff] bg-[#f7f6ff]"
                : "border-[#eceaf3] bg-white text-[#6b6880]"
            }`}
            onClick={() => setTab("items")}
          >
            <Box size={15} /> Items
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium border ${
              tab === "groups"
                ? "border-[#5b4bff] bg-[#f7f6ff]"
                : "border-[#eceaf3] bg-white text-[#6b6880]"
            }`}
            onClick={() => setTab("groups")}
          >
            <Layers size={15} /> Groups
          </button>
        </nav>

        {tab === "items" ? (
          <div className="space-y-4">
            <div className="avail-card p-5">
              <h2 className="text-[15px] font-bold mb-3">Add room or equipment</h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[13px] flex-1 min-w-[180px]">
                  <span className="font-medium">Name</span>
                  <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Massage Room 1" />
                </label>
                <label className="flex flex-col gap-1 text-[13px] w-28">
                  <span className="font-medium">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
                <Button size="sm" disabled={saving || !newName.trim()} onClick={() => void createResource()}>
                  Add
                </Button>
              </div>
              <p className="text-[11px] text-[#8a87a0] mt-2">
                How many identical units are available? Quantity 3 means three concurrent bookings can use this item.
              </p>
            </div>

            <div className="avail-card p-5">
              <h2 className="text-[15px] font-bold mb-3">All items</h2>
              {resources.length === 0 ? (
                <p className="text-[13px] text-[#8a87a0]">No rooms or equipment yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#eceaf3]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-[#8a87a0] border-b border-[#eceaf3] bg-[#faf9fc]">
                        <th className="px-4 py-2 font-semibold" scope="col">Name</th>
                        <th className="px-4 py-2 font-semibold" scope="col">Type</th>
                        <th className="px-4 py-2 font-semibold" scope="col">Quantity</th>
                        <th className="px-4 py-2 font-semibold" scope="col">Used by</th>
                        <th className="px-4 py-2 font-semibold" scope="col">Status</th>
                        <th className="px-4 py-2 font-semibold" scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2f1f7] bg-white">
                  {resources.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-[#1a1830]">{row.name}</td>
                      <td className="px-4 py-3 text-[#6b6880]">{resourceTypeLabel(row.name)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          className="input w-16"
                          defaultValue={row.quantity ?? 1}
                          id={`qty-${row.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#6b6880]">
                        {(row.eligibleTypeIds?.length ?? 0) > 0
                          ? `${row.eligibleTypeIds!.length} service${row.eligibleTypeIds!.length === 1 ? "" : "s"}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{row.active === false ? "Inactive" : "Active"}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            const el = document.getElementById(`qty-${row.id}`) as HTMLInputElement | null;
                            void saveResource(row, Math.max(1, Number(el?.value) || row.quantity || 1));
                          }}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "groups" ? (
          <div className="space-y-4">
            <div className="avail-card p-5 space-y-4">
              <h2 className="text-[15px] font-bold">{editingGroupId ? "Edit group" : "Create group"}</h2>
              <p className="text-[12px] text-[#8a87a0]">
                Use any available room or equipment from this group when booking.
              </p>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium">Group name</span>
                <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Any massage room" />
              </label>
              <div>
                <p className="text-[13px] font-medium mb-2">Members</p>
                <div className="flex flex-wrap gap-2">
                  {resources.map((r) => {
                    const on = groupMemberIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-[12px] border ${
                          on ? "bg-[#5b4bff] text-white border-[#5b4bff]" : "bg-white border-[#eceaf3]"
                        }`}
                        onClick={() =>
                          setGroupMemberIds((prev) =>
                            on ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                          )
                        }
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={saving} onClick={() => void saveGroup()}>
                  {saving ? "Saving…" : editingGroupId ? "Update group" : "Create group"}
                </Button>
                {editingGroupId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingGroupId(null);
                      setGroupName("");
                      setGroupMemberIds([]);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
              {message ? <p className="text-[12px] text-red-700">{message}</p> : null}
            </div>

            <div className="avail-card p-5">
              <h2 className="text-[15px] font-bold mb-3">Groups</h2>
              {groups.length === 0 ? (
                <p className="text-[13px] text-[#8a87a0]">No groups yet.</p>
              ) : (
                <ul className="space-y-2">
                  {groups.map((g) => (
                    <li key={g.id} className="flex items-center justify-between rounded-lg border border-[#eceaf3] px-4 py-3 text-[13px]">
                      <div>
                        <p className="font-medium">{g.name}</p>
                        <p className="text-[11px] text-[#8a87a0]">
                          {g.resourceIds.length} item{g.resourceIds.length === 1 ? "" : "s"}
                          {g.active === false ? " · Inactive" : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEditGroup(g)}>Edit</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
