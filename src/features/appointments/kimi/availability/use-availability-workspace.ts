"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildServiceRows,
  buildStaffRows,
  businessHoursOpenDays,
  upcomingOverrides,
} from "@/lib/appointments/availability/availability-workspace";
import type { AvailabilitySectionId } from "@/components/appointments/availability/availability-section-types";
import {
  buildSettingsPatch,
  EMPTY_AVAILABILITY_FORM,
  formStateFromSettings,
} from "./map-availability";
import type { AvailabilityFormState } from "./types";
import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

const VALID_SECTIONS = new Set<string>([
  "overview",
  "weekly-hours",
  "staff",
  "services",
  "locations",
  "overrides",
  "booking-rules",
  "calendars",
]);

type CalendarConnection = {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt?: string | null;
};

type SchedulingResource = {
  id: string;
  name: string;
  quantity: number;
  eligibleTypeIds?: string[];
};

export function useAvailabilityWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const section: AvailabilitySectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as AvailabilitySectionId)
      : "overview";

  const setSection = useCallback(
    (next: AvailabilitySectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/availability${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [form, setForm] = useState<AvailabilityFormState>(EMPTY_AVAILABILITY_FORM);
  const [staff, setStaff] = useState<BookableStaffMember[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; active?: boolean }>>([]);
  const [types, setTypes] = useState<
    Array<{ id: string; name: string; durationMinutes?: number; config?: AppointmentTypeConfig | null }>
  >([]);
  const [resources, setResources] = useState<SchedulingResource[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [settingsRes, typesRes, resourcesRes, calendarsRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/types"),
        fetch("/api/appointments/service-booking/resources").catch(() => null),
        fetch("/api/integrations/calendars").catch(() => null),
      ]);
      if (!settingsRes.ok) throw new Error("settings failed");
      const settingsJson = await settingsRes.json();
      const data = settingsJson.data || {};
      setForm(formStateFromSettings(data));
      setStaff((data.staff || []) as BookableStaffMember[]);
      setLocations(
        ((data.locations || []) as Array<{ id: string; name: string; active?: boolean }>).map((l) => ({
          id: l.id,
          name: l.name,
          active: l.active,
        })),
      );

      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      const typeRows = (typesJson.data || []) as Array<{
        id: string;
        name: string;
        durationMinutes?: number;
        config?: AppointmentTypeConfig | null;
      }>;
      setTypes(
        typeRows.filter((row) => {
          const kind = resolveBookingTypeKind(row.config);
          return kind === "SERVICE" || kind === "MEETING";
        }),
      );

      if (resourcesRes?.ok) {
        const resJson = await resourcesRes.json();
        setResources((resJson.data || []) as SchedulingResource[]);
      }

      if (calendarsRes?.ok) {
        const calJson = await calendarsRes.json();
        setConnections((calJson.data || []) as CalendarConnection[]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchForm = useCallback((patch: Partial<AvailabilityFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const updateWindow = useCallback(
    (day: string, index: number, field: "open" | "close", value: string) => {
      setForm((prev) => {
        const next = { ...prev.weeklyHours };
        const windows = [...(next[day] || [])];
        windows[index] = { ...windows[index], [field]: value };
        next[day] = windows;
        return { ...prev, weeklyHours: next };
      });
      setSaved(false);
    },
    [],
  );

  const toggleDayOpen = useCallback((day: string, open: boolean) => {
    setForm((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: open ? [{ open: "09:00", close: "17:00" }] : [],
      },
    }));
    setSaved(false);
  }, []);

  const addWindow = useCallback((day: string) => {
    setForm((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: [...(prev.weeklyHours[day] || []), { open: "09:00", close: "12:00" }],
      },
    }));
    setSaved(false);
  }, []);

  const removeWindow = useCallback((day: string, index: number) => {
    setForm((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: (prev.weeklyHours[day] || []).filter((_, i) => i !== index),
      },
    }));
    setSaved(false);
  }, []);

  const copyMondayToWeekdays = useCallback(() => {
    setForm((prev) => {
      const monday = prev.weeklyHours.monday || [];
      const next = { ...prev.weeklyHours };
      for (const key of ["tuesday", "wednesday", "thursday", "friday"] as const) {
        next[key] = monday.map((w) => ({ ...w }));
      }
      return { ...prev, weeklyHours: next };
    });
    setSaved(false);
  }, []);

  const addOverride = useCallback(() => {
    setForm((prev) => {
      if (!prev.overrideDate) return prev;
      const entry = prev.overrideClosed
        ? { date: prev.overrideDate, closed: true as const }
        : {
            date: prev.overrideDate,
            windows: [{ open: prev.overrideOpen, close: prev.overrideClose }],
          };
      return {
        ...prev,
        dateOverrides: [...prev.dateOverrides.filter((o) => o.date !== prev.overrideDate), entry].sort(
          (a, b) => a.date.localeCompare(b.date),
        ),
        overrideDate: "",
      };
    });
    setSaved(false);
  }, []);

  const removeOverride = useCallback((date: string) => {
    setForm((prev) => ({
      ...prev,
      dateOverrides: prev.dateOverrides.filter((o) => o.date !== date),
    }));
    setSaved(false);
  }, []);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSettingsPatch(form)),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as { error?: string }).error || "Could not save availability");
      return false;
    }
    setSaved(true);
    return true;
  }, [form]);

  const saveStaff = useCallback(async (nextStaff: BookableStaffMember[]) => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff: nextStaff }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as { error?: string }).error || "Could not save staff");
      return false;
    }
    setStaff(nextStaff);
    setSaved(true);
    return true;
  }, []);

  const updateStaffMember = useCallback(
    async (staffId: string, patch: Partial<BookableStaffMember>) => {
      const next = staff.map((s) => (s.id === staffId ? { ...s, ...patch } : s));
      setStaff(next);
      return saveStaff(next);
    },
    [saveStaff, staff],
  );

  const toggleStaffService = useCallback(
    async (staffId: string, typeId: string, included: boolean) => {
      const member = staff.find((s) => s.id === staffId);
      if (!member) return false;
      const ids = member.appointmentTypeIds || [];
      const nextIds = included ? ids.filter((id) => id !== typeId) : [...ids, typeId];
      return updateStaffMember(staffId, { appointmentTypeIds: nextIds });
    },
    [staff, updateStaffMember],
  );

  const toggleStaffLocation = useCallback(
    async (staffId: string, locationId: string, included: boolean) => {
      const member = staff.find((s) => s.id === staffId);
      if (!member) return false;
      const ids = member.locationIds || [];
      const nextIds = included ? ids.filter((id) => id !== locationId) : [...ids, locationId];
      return updateStaffMember(staffId, { locationIds: nextIds });
    },
    [staff, updateStaffMember],
  );

  const calendarByConnectionId = useMemo(() => {
    const map = new Map<string, { label: string; connected: boolean }>();
    for (const c of connections) {
      map.set(c.id, {
        label: `${c.provider === "google" ? "Google" : c.provider === "microsoft" ? "Microsoft" : c.provider} · ${c.name}`,
        connected: c.status === "connected" || c.status === "active",
      });
    }
    return map;
  }, [connections]);

  const staffRows = useMemo(() => {
    const byStaff = new Map<string, { label: string; connected: boolean }>();
    for (const member of staff) {
      if (member.calendarConnectionId) {
        const conn = calendarByConnectionId.get(member.calendarConnectionId);
        if (conn) byStaff.set(member.id, conn);
      }
    }
    return buildStaffRows(staff, form, byStaff);
  }, [calendarByConnectionId, form, staff]);

  const serviceRows = useMemo(
    () => buildServiceRows(types, staff, locations),
    [locations, staff, types],
  );

  const stats = useMemo(() => {
    const activeStaff = staff.filter((s) => s.active !== false);
    const scheduled = staffRows.filter((r) => r.status !== "no_schedule").length;
    const servicesWithStaff = serviceRows.filter((r) => r.eligibleStaffCount > 0).length;
    return {
      openDays: businessHoursOpenDays(form),
      staffTotal: activeStaff.length,
      staffScheduled: scheduled,
      staffNeedsSetup: activeStaff.length - scheduled,
      upcomingOverrideCount: form.dateOverrides.filter((o) => o.date >= new Date().toISOString().slice(0, 10)).length,
      servicesTotal: serviceRows.length,
      servicesWithStaff,
      locationsActive: locations.filter((l) => l.active !== false).length,
      resourcesCount: resources.length,
      calendarsConnected: connections.filter((c) => c.status === "connected" || c.status === "active").length,
    };
  }, [connections, form, locations, resources.length, serviceRows, staff, staffRows]);

  const attention = useMemo(() => {
    const flags = new Set<AvailabilitySectionId>();
    if (stats.openDays === 0) flags.add("weekly-hours");
    if (stats.staffNeedsSetup > 0) flags.add("staff");
    if (stats.servicesWithStaff < stats.servicesTotal) flags.add("services");
    return flags;
  }, [stats]);

  const overviewOverrides = useMemo(() => upcomingOverrides(form), [form]);

  return {
    section,
    setSection,
    form,
    staff,
    locations,
    types,
    resources,
    connections,
    staffRows,
    serviceRows,
    stats,
    attention,
    overviewOverrides,
    loading,
    failed,
    saving,
    saved,
    error,
    load,
    patchForm,
    updateWindow,
    toggleDayOpen,
    addWindow,
    removeWindow,
    copyMondayToWeekdays,
    addOverride,
    removeOverride,
    saveSettings,
    saveStaff,
    updateStaffMember,
    toggleStaffService,
    toggleStaffLocation,
    calendarByConnectionId,
  };
}
