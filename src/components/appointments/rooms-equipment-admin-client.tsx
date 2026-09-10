"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ResourceRow = {
  id: string;
  name: string;
  quantity?: number;
  description?: string | null;
  active?: boolean;
  locationId?: string | null;
};

type ResourceGroupRow = {
  id: string;
  name: string;
  resourceIds: string[];
  selectionMode?: "any_one" | "all_required";
  active?: boolean;
};

type LocationRow = { id: string; name: string };

export function RoomsEquipmentAdminClient() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [groups, setGroups] = useState<ResourceGroupRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupResourceIds, setGroupResourceIds] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState<"any_one" | "all_required">("any_one");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resourcesRes, groupsRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/service-booking/resources"),
        fetch("/api/appointments/service-booking/resource-groups"),
        fetch("/api/appointments/settings"),
      ]);
      const resourcesJson = await resourcesRes.json();
      const groupsJson = groupsRes.ok ? await groupsRes.json() : { data: [] };
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      if (!resourcesRes.ok) throw new Error(resourcesJson.error || "Could not load resources");
      const rows = (resourcesJson.data || []) as ResourceRow[];
      setResources(rows);
      const nextQty: Record<string, number> = {};
      for (const row of rows) nextQty[row.id] = row.quantity ?? 1;
      setQtyDrafts(nextQty);
      setGroups((groupsJson.data || groupsJson || []) as ResourceGroupRow[]);
      setLocations(
        ((settingsJson.data?.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
          id: l.id,
          name: l.name,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveQuantity(row: ResourceRow) {
    const quantity = qtyDrafts[row.id] ?? row.quantity ?? 1;
    setSavingId(row.id);
    setMessage(null);
    const res = await fetch("/api/appointments/service-booking/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, name: row.name, quantity, active: row.active ?? true }),
    });
    setSavingId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Could not save resource");
      return;
    }
    setMessage(`Saved ${row.name}`);
    await load();
  }

  async function createGroup() {
    if (!groupName.trim() || groupResourceIds.length === 0) {
      setMessage("Enter a group name and select at least one item.");
      return;
    }
    setMessage(null);
    const res = await fetch("/api/appointments/service-booking/resource-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: groupName.trim(),
        resourceIds: groupResourceIds,
        selectionMode: groupMode,
        active: true,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Could not create group");
      return;
    }
    setGroupName("");
    setGroupResourceIds([]);
    setMessage("Group created");
    await load();
  }

  async function removeGroup(id: string) {
    setMessage(null);
    const res = await fetch("/api/appointments/service-booking/resource-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: groups.find((g) => g.id === id)?.name || "Group", resourceIds: [], active: false }),
    });
    if (!res.ok) {
      setMessage("Could not remove group");
      return;
    }
    await load();
  }

  function locationLabel(locationId?: string | null) {
    if (!locationId) return "All locations";
    return locations.find((l) => l.id === locationId)?.name || "Location";
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground p-6">Loading rooms & equipment…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive m-6">
        {error}
        <button type="button" className="ml-3 underline" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Rooms & equipment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage bookable rooms, equipment, quantities, and groups used by services and classes.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="re-items-heading">
        <h2 id="re-items-heading" className="text-sm font-semibold">Items</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            No rooms or equipment yet. Add items in{" "}
            <Link href="/appointments/packages" className="text-primary underline">packages &amp; sales settings</Link> or create via API.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {resources.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{locationLabel(row.locationId)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <span>Qty</span>
                    <input
                      type="number"
                      min={1}
                      className="w-20 rounded border px-2 py-1"
                      value={qtyDrafts[row.id] ?? row.quantity ?? 1}
                      onChange={(e) =>
                        setQtyDrafts((prev) => ({
                          ...prev,
                          [row.id]: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1.5 text-sm"
                    disabled={savingId === row.id}
                    onClick={() => void saveQuantity(row)}
                  >
                    {savingId === row.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="re-groups-heading">
        <div>
          <h2 id="re-groups-heading" className="text-sm font-semibold">Groups</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Use a group when booking can use any available room from a set (for example, Massage Rooms).
          </p>
        </div>
        {groups.filter((g) => g.active !== false).length > 0 ? (
          <ul className="divide-y rounded-lg border bg-card">
            {groups
              .filter((g) => g.active !== false)
              .map((group) => (
                <li key={group.id} className="p-4 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{group.name}</span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => void removeGroup(group.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {group.selectionMode === "all_required" ? "All required" : "Any available"} ·{" "}
                    {group.resourceIds
                      .map((id) => resources.find((r) => r.id === id)?.name || id)
                      .join(", ")}
                  </p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        )}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">Create group</p>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Group name (e.g. Massage Rooms)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <fieldset>
            <legend className="text-xs text-muted-foreground mb-2">Items in group</legend>
            <div className="flex flex-wrap gap-2">
              {resources.map((r) => (
                <label key={r.id} className="flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-background">
                  <input
                    type="checkbox"
                    checked={groupResourceIds.includes(r.id)}
                    onChange={() =>
                      setGroupResourceIds((prev) =>
                        prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                      )
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <span>Selection</span>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as "any_one" | "all_required")}
            >
              <option value="any_one">Any available item</option>
              <option value="all_required">All items required</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => void createGroup()}
          >
            Create group
          </button>
        </div>
      </section>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
