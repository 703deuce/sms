"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  formStateFromApiType,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import { isMeetingRow } from "@/lib/appointments/meetings/meeting-display";
import { newLocation, newStaffMember } from "@/features/appointments/kimi/shared/platform-settings-types";
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from "@/lib/appointments/bookable-workspace-routes";

export type MeetingEditorOptions = {
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
};

type SettingsPayload = {
  data?: {
    staff?: Array<{ id: string; name: string; active?: boolean }>;
    locations?: Array<{ id: string; name: string; active?: boolean }>;
    namedSchedules?: Array<{ id: string; name: string }>;
    bookingEnabled?: boolean;
  };
  workspace?: { slug?: string | null } | null;
};

function optionsFromSettings(
  json: SettingsPayload,
  payments: { providers?: Array<{ provider: "stripe" | "square"; label?: string; connected?: boolean }> },
): MeetingEditorOptions {
  const platform = json.data || {};
  return {
    staffOptions: (platform.staff || [])
      .filter((s) => s.active !== false)
      .map((s) => ({ id: s.id, name: s.name })),
    locationOptions: (platform.locations || [])
      .filter((l) => l.active !== false)
      .map((l) => ({ id: l.id, name: l.name })),
    connectedPaymentProviders: (payments.providers || [])
      .filter((p) => p.connected)
      .map((p) => ({ provider: p.provider, label: p.label || p.provider })),
    namedScheduleOptions: (platform.namedSchedules || []).map((s) => ({ id: s.id, name: s.name })),
  };
}

export function useMeetingEditor(
  meetingId: string | null,
  routes: MeetingsWorkspaceRoutes = APPOINTMENTS_MEETINGS_ROUTES,
) {
  const router = useRouter();
  const isCreating = !meetingId;

  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [options, setOptions] = useState<MeetingEditorOptions>({
    staffOptions: [],
    locationOptions: [],
    connectedPaymentProviders: [],
    namedScheduleOptions: [],
  });

  const initCreateForm = useCallback(() => {
    const segment = segmentById("meetings");
    const kindPatch = defaultConfigPatchForKind("MEETING");
    const segmentPatch = defaultConfigForSegment(segment);
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "MEETING",
      classPresentation: "recurring_class",
      groupBookingEnabled: false,
      groupCapacity: 1,
      recurringEnabled: false,
      paymentMode: "none",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes, paymentsRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
        fetch("/api/merchant-payments/status"),
      ]);
      if (!typesRes.ok || !settingsRes.ok) throw new Error("load failed");

      const typesJson = await typesRes.json();
      const settingsJson = (await settingsRes.json()) as SettingsPayload;
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { providers: [] };

      setWorkspaceSlug(settingsJson.workspace?.slug || "");
      setBookingEnabled(Boolean(settingsJson.data?.bookingEnabled));
      setOptions(optionsFromSettings(settingsJson, paymentsJson));

      if (isCreating) {
        initCreateForm();
      } else {
        const rows = (typesJson.data || []) as ApiAppointmentType[];
        const row = rows.find((t) => t.id === meetingId);
        if (!row || !isMeetingRow(row)) throw new Error("not a meeting");
        const loaded = formStateFromApiType(row);
        setForm(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
        setSaveStatus("saved");
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initCreateForm, isCreating, meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        const dirty = JSON.stringify(next) !== savedSnapshot;
        setSaveStatus(dirty ? "dirty" : "saved");
        return next;
      });
      setError("");
    },
    [savedSnapshot],
  );

  const setFormBulk = useCallback((next: AppointmentTypeFormState) => {
    setForm(next);
    const dirty = JSON.stringify(next) !== savedSnapshot;
    setSaveStatus(dirty ? "dirty" : "saved");
    setError("");
  }, [savedSnapshot]);

  const bookingBaseUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}`;
  }, [workspaceSlug]);

  const bookingLink = useMemo(() => {
    if (!bookingBaseUrl || !meetingId) return null;
    return `${bookingBaseUrl}/${encodeURIComponent(meetingId)}`;
  }, [bookingBaseUrl, meetingId]);

  const save = useCallback(async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError("Meeting name is required");
      return null;
    }
    setSaving(true);
    setSaveStatus("saving");
    setError("");
    const payload = buildSavePayload({ ...form, bookingTypeKind: "MEETING" });
    const res = await fetch(
      isCreating ? "/api/appointments/types" : `/api/appointments/types/${meetingId}`,
      {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save meeting");
      setSaving(false);
      setSaveStatus("error");
      return null;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    setSaving(false);
    const nextForm = formStateFromApiType(saved);
    setForm(nextForm);
    setSavedSnapshot(JSON.stringify(nextForm));
    setSaveStatus("saved");
    if (isCreating) {
      router.replace(routes.detail(saved.id));
    }
    return saved.id;
  }, [form, isCreating, meetingId, router, routes]);

  const duplicate = useCallback(async () => {
    if (!meetingId) return;
    setSaving(true);
    const payload = buildSavePayload({
      ...form,
      name: `${form.name.trim()} (copy)`,
      bookingTypeKind: "MEETING",
    });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      router.push(routes.detail((json.data as ApiAppointmentType).id));
    }
  }, [form, meetingId, router, routes]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      updateForm("enabled", enabled);
      if (!meetingId) return;
      setSaving(true);
      const nextForm = { ...form, enabled };
      await fetch(`/api/appointments/types/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(nextForm)),
      });
      setSaving(false);
    },
    [form, meetingId, updateForm],
  );

  /**
   * Creates a bookable staff member from inside the editor so an empty host list
   * never forces the user out to /appointments/staff and lose an unsaved draft.
   */
  const addStaffMember = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const current = await fetch("/api/appointments/settings");
      if (!current.ok) return null;
      const currentJson = (await current.json()) as SettingsPayload;
      const existing = currentJson.data?.staff || [];
      const member = { ...newStaffMember(), name: trimmed };
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff: [...existing, member] }),
      });
      if (!res.ok) return null;
      const saved = (await res.json()) as { data?: SettingsPayload["data"] };
      const savedStaff = saved.data?.staff || [];
      const created = savedStaff.find((s) => s.name === trimmed) || member;
      setOptions((prev) => ({
        ...prev,
        staffOptions: savedStaff
          .filter((s) => s.active !== false)
          .map((s) => ({ id: s.id, name: s.name })),
      }));
      return created.id;
    },
    [],
  );

  const addLocation = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = await fetch("/api/appointments/settings");
    if (!current.ok) return null;
    const currentJson = (await current.json()) as SettingsPayload;
    const existing = currentJson.data?.locations || [];
    const location = { ...newLocation(), name: trimmed };
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: [...existing, location] }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as { data?: SettingsPayload["data"] };
    const savedLocations = saved.data?.locations || [];
    const created = savedLocations.find((l) => l.name === trimmed) || location;
    setOptions((prev) => ({
      ...prev,
      locationOptions: savedLocations
        .filter((l) => l.active !== false)
        .map((l) => ({ id: l.id, name: l.name })),
    }));
    return created.id;
  }, []);

  const copyBookingLink = useCallback(async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [bookingLink]);

  const previewBooking = useCallback(() => {
    if (bookingLink) window.open(bookingLink, "_blank");
  }, [bookingLink]);

  const isDirty = saveStatus === "dirty";

  return {
    form,
    updateForm,
    setFormBulk,
    options,
    loading,
    failed,
    saving,
    error,
    isCreating,
    isDirty,
    saveStatus,
    bookingEnabled,
    bookingLink,
    copied,
    load,
    save,
    duplicate,
    setEnabled,
    addStaffMember,
    addLocation,
    copyBookingLink,
    previewBooking,
  };
}
