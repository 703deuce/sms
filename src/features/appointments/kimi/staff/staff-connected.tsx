"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffView from "@/components/appointments/kimi-ui/staff/page";
import {
  buildStaffDayRows,
  filterStaffList,
  mapStaffToListItem,
} from "@/features/appointments/kimi/staff/map-staff";
import type { StaffEditorTab, StaffPageActions } from "@/features/appointments/kimi/staff/types";
import { newStaffMember } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { BookableStaffMember } from "@/lib/appointments/types";

function StaffLoading() {
  return (
    <div className="reference-root min-h-full bg-[#f7f8fb] p-8 font-sans animate-pulse">
      <div className="max-w-[1280px] mx-auto space-y-5">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5">
          <div className="h-[560px] rounded-xl bg-white border border-[#ecedf2]" />
          <div className="h-[560px] rounded-xl bg-white border border-[#ecedf2]" />
        </div>
      </div>
    </div>
  );
}

function StaffError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="reference-root min-h-full bg-[#f7f8fb] p-8 font-sans flex items-center justify-center">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load staff</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your team members and assignments.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function StaffConnected() {
  const [staff, setStaff] = useState<BookableStaffMember[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editorTab, setEditorTab] = useState<StaffEditorTab>("details");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  const [roundRobinState, setRoundRobinState] = useState<Record<string, { lastAssignedStaffId?: string; counts?: Record<string, number> }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [settingsRes, typesRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/types"),
      ]);
      if (!settingsRes.ok) throw new Error("settings failed");
      const settingsJson = await settingsRes.json();
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      const data = settingsJson.data || {};
      const nextStaff = (data.staff || []) as BookableStaffMember[];
      setStaff(nextStaff);
      setCalendarColors((data.calendarColors?.staffColors || {}) as Record<string, string>);
      setRoundRobinState((data.roundRobinState || {}) as Record<string, { lastAssignedStaffId?: string; counts?: Record<string, number> }>);
      setLocations(
        ((data.locations || []) as Array<{ id: string; name: string }>).map((l) => ({
          id: l.id,
          name: l.name,
        })),
      );
      setAppointmentTypes(
        (typesJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
      );
      if (nextStaff.length && !selectedId) {
        setSelectedId(nextStaff[0].id);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = staff.find((s) => s.id === selectedId) || null;
  const staffItems = useMemo(() => staff.map(mapStaffToListItem), [staff]);
  const visibleStaff = useMemo(() => filterStaffList(staffItems, searchQuery), [staffItems, searchQuery]);
  const dayRows = useMemo(() => buildStaffDayRows(selected), [selected]);

  function updateSelected(patch: Partial<BookableStaffMember>) {
    if (!selectedId) return;
    setStaff((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  const actions: StaffPageActions = {
    onSearchChange: setSearchQuery,
    onSelectStaff: setSelectedId,
    onTabChange: setEditorTab,
    onAddStaff: () => {
      const member = newStaffMember();
      setStaff((prev) => [...prev, member]);
      setSelectedId(member.id);
      setEditorTab("details");
      setSaved(false);
    },
    onRemoveStaff: (id) => {
      setStaff((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      setSaved(false);
    },
    onNameChange: (value) => updateSelected({ name: value }),
    onActiveChange: (value) => updateSelected({ active: value }),
    onCustomerSelectableChange: (value) => updateSelected({ customerSelectable: value }),
    onToggleTypeId: (typeId) => {
      if (!selected) return;
      const ids = selected.appointmentTypeIds || [];
      updateSelected({
        appointmentTypeIds: ids.includes(typeId) ? ids.filter((id) => id !== typeId) : [...ids, typeId],
      });
    },
    onToggleLocationId: (locationId) => {
      if (!selected) return;
      const ids = selected.locationIds || [];
      updateSelected({
        locationIds: ids.includes(locationId) ? ids.filter((id) => id !== locationId) : [...ids, locationId],
      });
    },
    onSetCustomHours: (dayKey, enabled) => {
      if (!selected) return;
      const hours = { ...(selected.weeklyHours || {}) };
      if (enabled) {
        updateSelected({ weeklyHours: { ...hours, [dayKey]: [{ open: "09:00", close: "17:00" }] } });
      } else {
        updateSelected({ weeklyHours: { ...hours, [dayKey]: [] } });
      }
    },
    onUpdateWindow: (dayKey, index, field, value) => {
      if (!selected) return;
      const hours = { ...(selected.weeklyHours || {}) };
      const next = [...(hours[dayKey] || [])];
      next[index] = { ...next[index], [field]: value };
      updateSelected({ weeklyHours: { ...hours, [dayKey]: next } });
    },
    onAddWindow: (dayKey) => {
      if (!selected) return;
      const hours = { ...(selected.weeklyHours || {}) };
      const next = [...(hours[dayKey] || []), { open: "09:00", close: "17:00" }];
      updateSelected({ weeklyHours: { ...hours, [dayKey]: next } });
    },
    onCalendarColorChange: (value) => {
      if (!selectedId) return;
      setCalendarColors((prev) => ({ ...prev, [selectedId]: value }));
      setSaved(false);
    },
    onRoundRobinEligibleChange: (value) => updateSelected({ roundRobinEligible: value }),
    onSave: async () => {
      setSaving(true);
      setError("");
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff,
          calendarColors: { staffColors: calendarColors },
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Could not save");
        return;
      }
      setSaved(true);
      await load();
    },
    onRetry: load,
  };

  if (loading) return <StaffLoading />;
  if (failed) return <StaffError onRetry={load} />;

  const roundRobinStateSummary = selected
    ? (() => {
        const counts = Object.values(roundRobinState)
          .flatMap((entry) => Object.entries(entry.counts || {}))
          .filter(([staffId]) => staffId === selected.id);
        if (!counts.length) return null;
        const total = counts.reduce((sum, [, n]) => sum + (n || 0), 0);
        return total > 0 ? `Assigned ${total} time${total === 1 ? "" : "s"} via round robin recently` : null;
      })()
    : null;

  return (
    <StaffView
      model={{
        staff: staffItems,
        visibleStaff,
        selectedId,
        selected,
        searchQuery,
        editorTab,
        appointmentTypes,
        locations,
        dayRows,
        calendarColor: selected ? calendarColors[selected.id] || "#6366f1" : "#6366f1",
        roundRobinStateSummary,
        saving,
        saved,
        error,
      }}
      actions={actions}
    />
  );
}
