"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Layers, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  formatLocationNames,
  resourceKindLabel,
  resourceLocationIds,
  type ResourceGroupRow,
  type SchedulingResourceRow,
  usedByCount,
} from "@/lib/appointments/rooms-equipment/resource-display";
import { RoomsEquipmentGroupsView } from "./rooms-equipment-groups-view";
import "@/components/appointments/kimi-ui/overview/reference.css";

type ViewMode = "items" | "groups";

export function RoomsEquipmentListConnected() {
  const [view, setView] = useState<ViewMode>("items");
  const [rows, setRows] = useState<SchedulingResourceRow[]>([]);
  const [groups, setGroups] = useState<ResourceGroupRow[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [resRes, grpRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/service-booking/resources"),
        fetch("/api/appointments/service-booking/resource-groups"),
        fetch("/api/appointments/settings"),
      ]);
      if (!resRes.ok) throw new Error("resources failed");
      const resJson = await resRes.json();
      const grpJson = grpRes.ok ? await grpRes.json() : { data: [] };
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      setRows((resJson.data || resJson || []) as SchedulingResourceRow[]);
      setGroups((grpJson.data || grpJson || []) as ResourceGroupRow[]);
      setLocations(
        ((settingsJson.data?.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
          id: l.id,
          name: l.name,
        })),
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = useCallback(
    async (row: SchedulingResourceRow, active: boolean) => {
      await fetch("/api/appointments/service-booking/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          name: row.name,
          quantity: row.quantity,
          active,
          eligibleTypeIds: row.eligibleTypeIds,
          locationIds: resourceLocationIds(row),
          kind: row.metadata?.kind,
          description: row.description,
        }),
      });
      await load();
    },
    [load],
  );

  const duplicateRow = useCallback(
    async (row: SchedulingResourceRow) => {
      await fetch("/api/appointments/service-booking/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          quantity: row.quantity,
          active: row.active,
          eligibleTypeIds: row.eligibleTypeIds,
          locationIds: resourceLocationIds(row),
          kind: row.metadata?.kind,
          description: row.description,
        }),
      });
      await load();
    },
    [load],
  );

  if (loading) {
    return (
      <div className="appt-overview-pilot min-h-screen bg-[#f7f8fb] p-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 rounded mb-6" />
        <div className="h-64 bg-white rounded-xl border" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot min-h-screen bg-[#f7f8fb] p-6 flex items-center justify-center">
        <div className="text-center rounded-xl border bg-white px-8 py-10 max-w-md">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-600 mb-3" />
          <p className="text-sm font-medium text-gray-900">Could not load rooms and equipment</p>
          <button type="button" className="mt-4 text-sm text-[#5b4bff] font-semibold" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="appt-overview-pilot min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <RefDecoPageHeader
          title="Rooms & Equipment"
          description="Manage rooms and equipment that must be available when customers book."
          action={
            <Link
              href="/appointments/rooms-equipment/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
            >
              <Plus size={15} /> Add room or equipment
            </Link>
          }
        />

        <div className="flex gap-2 mb-5" role="tablist" aria-label="Rooms and equipment views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "items"}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
              view === "items" ? "bg-white border shadow-sm text-[#1a1d29]" : "text-[#8a8fa3]"
            }`}
            onClick={() => setView("items")}
          >
            All items
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "groups"}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium ${
              view === "groups" ? "bg-white border shadow-sm text-[#1a1d29]" : "text-[#8a8fa3]"
            }`}
            onClick={() => setView("groups")}
          >
            <Layers size={14} /> Groups
          </button>
        </div>

        {view === "groups" ? (
          <RoomsEquipmentGroupsView
            groups={groups}
            resources={rows}
            onReload={load}
          />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center">
            <Plus className="h-10 w-10 mx-auto text-[#c6c9d6] mb-3" />
            <h2 className="text-[15px] font-semibold text-[#1a1d29]">
              Add the rooms and equipment your bookings depend on
            </h2>
            <p className="text-[13px] text-[#8a8fa3] mt-2 max-w-md mx-auto">
              Use Rooms & Equipment when a service or class needs a physical room, tool, or piece of equipment to be available.
            </p>
            <Link
              href="/appointments/rooms-equipment/new"
              className="inline-flex items-center gap-1.5 mt-5 rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white"
            >
              <Plus size={15} /> Add room or equipment
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-[#fafbfc] text-left text-[#6b6f82]">
                  <th className="px-4 py-3 font-semibold" scope="col">Name</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Type</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Location</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Quantity</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Used by</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-4 py-3 font-semibold w-12" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-[#fafbfc]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/appointments/rooms-equipment/${row.id}`}
                        className="font-medium text-[#5b4bff] hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#6b6f82]">{resourceKindLabel(row)}</td>
                    <td className="px-4 py-3 text-[#6b6f82]">
                      {formatLocationNames(resourceLocationIds(row), locations)}
                    </td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3 text-[#6b6f82]">
                      {usedByCount(row) ? `${usedByCount(row)} services` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-100"
                        aria-label={`Actions for ${row.name}`}
                        onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenuId === row.id ? (
                        <div className="absolute right-4 top-10 z-10 min-w-[140px] rounded-lg border bg-white shadow-lg py-1">
                          <Link
                            href={`/appointments/rooms-equipment/${row.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Pencil size={14} /> Edit
                          </Link>
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 text-left"
                            onClick={() => {
                              setOpenMenuId(null);
                              void duplicateRow(row);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 text-left"
                            onClick={() => {
                              setOpenMenuId(null);
                              void toggleActive(row, !row.active);
                            }}
                          >
                            {row.active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
