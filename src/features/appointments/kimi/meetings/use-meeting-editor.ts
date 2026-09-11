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

export type MeetingEditorOptions = {
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
};

export function useMeetingEditor(meetingId: string | null) {
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
      const settingsJson = await settingsRes.json();
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { providers: [] };

      const platform = settingsJson.data?.platform || settingsJson.platform || {};
      setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
      setBookingEnabled(Boolean(settingsJson.data?.bookingEnabled ?? settingsJson.bookingEnabled));

      setOptions({
        staffOptions: (platform.staff || [])
          .filter((s: { active?: boolean }) => s.active !== false)
          .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        locationOptions: (platform.locations || [])
          .filter((l: { active?: boolean }) => l.active !== false)
          .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
        connectedPaymentProviders: (paymentsJson.providers || [])
          .filter((p: { connected?: boolean }) => p.connected)
          .map((p: { provider: "stripe" | "square"; label?: string }) => ({
            provider: p.provider,
            label: p.label || p.provider,
          })),
        namedScheduleOptions: (platform.namedSchedules || []).map((s: { id: string; name: string }) => ({
          id: s.id,
          name: s.name,
        })),
      });

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
      router.replace(`/appointments/meetings/${saved.id}`);
    }
    return saved.id;
  }, [form, isCreating, meetingId, router]);

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
      router.push(`/appointments/meetings/${(json.data as ApiAppointmentType).id}`);
    }
  }, [form, meetingId, router]);

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
    copyBookingLink,
    previewBooking,
  };
}
