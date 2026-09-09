"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  formStateFromApiType,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  defaultConfigForSegment,
  segmentById,
  type BookingTypesSegmentId,
} from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import { isRecurringClassRow, isWorkshopEventRow } from "@/lib/appointments/classes/class-display";
import {
  buildOccurrencePayloads,
  previewOccurrenceDates,
  type ClassScheduleInput,
} from "@/lib/appointments/classes/schedule-utils";

export type ClassEditorOptions = {
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  categoryOptions: Array<{ id: string; name: string }>;
  intakeFormOptions: Array<{ id: string; name: string; active?: boolean }>;
};

export type ClassScheduleState = ClassScheduleInput & {
  seriesId: string | null;
  waitlistEnabled: boolean;
  capacityDisplayMode: "exact" | "limited" | "hidden";
  timezone: string;
};

const DEFAULT_SCHEDULE: ClassScheduleState = {
  seriesId: null,
  startDate: new Date().toISOString().slice(0, 10),
  startTime: "18:00",
  durationMinutes: 60,
  weekdays: [2],
  maxOccurrences: 12,
  isWorkshop: false,
  waitlistEnabled: false,
  capacityDisplayMode: "limited",
  timezone: "America/Chicago",
};

function draftKey(segmentId: BookingTypesSegmentId, typeId: string | null): string {
  return `transovo:${segmentId}-editor:${typeId || "new"}`;
}

function readDraft(segmentId: BookingTypesSegmentId, typeId: string | null) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(segmentId, typeId));
    if (!raw) return null;
    return JSON.parse(raw) as { form?: AppointmentTypeFormState; schedule?: ClassScheduleState };
  } catch {
    return null;
  }
}

function writeDraft(
  segmentId: BookingTypesSegmentId,
  typeId: string | null,
  form: AppointmentTypeFormState,
  schedule: ClassScheduleState,
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      draftKey(segmentId, typeId),
      JSON.stringify({ savedAt: Date.now(), form, schedule }),
    );
  } catch {
    // ignore
  }
}

function clearDraft(segmentId: BookingTypesSegmentId, typeId: string | null) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(segmentId, typeId));
}

export function useClassEditor(
  segmentId: "classes" | "workshops",
  typeId: string | null,
) {
  const router = useRouter();
  const isCreating = !typeId;
  const isWorkshop = segmentId === "workshops";

  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [schedule, setSchedule] = useState<ClassScheduleState>({
    ...DEFAULT_SCHEDULE,
    isWorkshop,
    weekdays: isWorkshop ? [] : [2],
    maxOccurrences: isWorkshop ? 1 : 12,
  });
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ClassEditorOptions>({
    staffOptions: [],
    locationOptions: [],
    connectedPaymentProviders: [],
    categoryOptions: [],
    intakeFormOptions: [],
  });
  const draftRestoredRef = useRef(false);

  const initCreateForm = useCallback(() => {
    const segment = segmentById(segmentId);
    const stored = readDraft(segmentId, null);
    if (stored?.form && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setForm({ ...stored.form, bookingTypeKind: "CLASS" });
      if (stored.schedule) setSchedule({ ...stored.schedule, isWorkshop });
      return;
    }
    const kindPatch = defaultConfigPatchForKind("CLASS");
    const segmentPatch = defaultConfigForSegment(segment);
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "CLASS",
      classPresentation: segment.classPresentation ?? "recurring_class",
      groupBookingEnabled: true,
      groupCapacity: segmentPatch.groupBooking?.capacity ?? 10,
      recurringEnabled: segment.classPresentation !== "workshop_event",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);
    setSchedule({
      ...DEFAULT_SCHEDULE,
      isWorkshop,
      durationMinutes: 60,
      weekdays: isWorkshop ? [] : [2],
      maxOccurrences: isWorkshop ? 1 : 12,
    });
  }, [isWorkshop, segmentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes, paymentsRes, categoriesRes, intakeRes, seriesRes] =
        await Promise.all([
          fetch("/api/appointments/types"),
          fetch("/api/appointments/settings"),
          fetch("/api/merchant-payments/status"),
          fetch("/api/appointments/service-booking/categories"),
          fetch("/api/appointments/service-booking/intake-forms?targetKind=appointment"),
          fetch("/api/appointments/service-booking/classes"),
        ]);
      if (!typesRes.ok || !settingsRes.ok) throw new Error("load failed");

      const typesJson = await typesRes.json();
      const settingsJson = await settingsRes.json();
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { data: { connections: [] } };
      const categoriesJson = categoriesRes.ok ? await categoriesRes.json() : null;
      const intakeJson = intakeRes.ok ? await intakeRes.json() : null;
      const seriesJson = seriesRes.ok ? await seriesRes.json() : { data: [] };

      const platform = settingsJson.data?.platform || settingsJson.platform || {};
      setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
      setOptions({
        staffOptions: (platform.staff || [])
          .filter((s: { active?: boolean }) => s.active !== false)
          .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        locationOptions: (platform.locations || [])
          .filter((l: { active?: boolean }) => l.active !== false)
          .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
        connectedPaymentProviders: (paymentsJson.data?.connections || [])
          .filter((c: { canAcceptPayments?: boolean }) => c.canAcceptPayments)
          .map((c: { provider: string }) => ({
            provider: c.provider.toLowerCase() as "stripe" | "square",
            label: c.provider === "STRIPE" ? "Stripe" : "Square",
          })),
        categoryOptions: categoriesJson
          ? ((categoriesJson.data || categoriesJson || []) as Array<{ id: string; name: string }>).map(
              (c) => ({ id: c.id, name: c.name }),
            )
          : [],
        intakeFormOptions: intakeJson
          ? ((intakeJson.data || intakeJson || []) as Array<{ id: string; name: string; active?: boolean }>).map(
              (f) => ({ id: f.id, name: f.name, active: f.active }),
            )
          : [],
      });

      if (isCreating) {
        initCreateForm();
      } else {
        const rows = (typesJson.data || []) as ApiAppointmentType[];
        const row = rows.find((t) => t.id === typeId);
        const valid =
          row &&
          (segmentId === "classes" ? isRecurringClassRow(row) : isWorkshopEventRow(row));
        if (!valid) throw new Error("not found");

        const stored = readDraft(segmentId, typeId);
        if (stored?.form && !draftRestoredRef.current) {
          draftRestoredRef.current = true;
          setForm(stored.form);
          if (stored.schedule) setSchedule(stored.schedule);
        } else {
          setForm(formStateFromApiType(row));
        }

        const allSeries = (seriesJson.data || []) as Array<{
          id: string;
          appointmentTypeId?: string | null;
          capacity: number;
          staffId?: string | null;
          locationId?: string | null;
          recurrenceRule?: Record<string, unknown> | null;
          occurrences?: Array<{ startsAt: string; endsAt: string }>;
        }>;
        const linked = allSeries.find((s) => s.appointmentTypeId === typeId);
        if (linked) {
          const firstOcc = linked.occurrences?.[0];
          const rule = (linked.recurrenceRule || {}) as Record<string, unknown>;
          setSchedule((prev) => ({
            ...prev,
            seriesId: linked.id,
            capacityDisplayMode:
              (rule.capacityDisplayMode as ClassScheduleState["capacityDisplayMode"]) || prev.capacityDisplayMode,
            waitlistEnabled: Boolean(rule.waitlistEnabled),
            durationMinutes: row.durationMinutes || prev.durationMinutes,
            ...(firstOcc
              ? {
                  startDate: new Date(firstOcc.startsAt).toISOString().slice(0, 10),
                  startTime: new Date(firstOcc.startsAt).toTimeString().slice(0, 5),
                }
              : {}),
            weekdays: Array.isArray(rule.weekdays)
              ? (rule.weekdays as number[])
              : prev.weekdays,
          }));
          if (linked.staffId) {
            setForm((f) => ({ ...f, staffIds: [linked.staffId!], staffAssignment: "specific_staff" }));
          }
          if (linked.locationId) {
            setForm((f) => ({ ...f, locationId: linked.locationId!, locationIds: [linked.locationId!] }));
          }
        }
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initCreateForm, isCreating, segmentId, typeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        writeDraft(segmentId, typeId, next, schedule);
        return next;
      });
      setError("");
    },
    [schedule, segmentId, typeId],
  );

  const updateSchedule = useCallback(
    <K extends keyof ClassScheduleState>(key: K, value: ClassScheduleState[K]) => {
      setSchedule((prev) => {
        const next = { ...prev, [key]: value };
        writeDraft(segmentId, typeId, form, next);
        return next;
      });
    },
    [form, segmentId, typeId],
  );

  const persistDraft = useCallback(() => {
    writeDraft(segmentId, typeId, form, schedule);
  }, [form, schedule, segmentId, typeId]);

  const occurrencePreview = useMemo(
    () => previewOccurrenceDates({ ...schedule, durationMinutes: form.durationMinutes }),
    [form.durationMinutes, schedule],
  );

  const syncSeries = useCallback(
    async (savedTypeId: string) => {
      const wasNewSeries = !schedule.seriesId;
      const staffId = form.staffIds[0] || undefined;
      const locationId = form.locationId || form.locationIds[0] || undefined;
      const recurrenceRule = {
        weekdays: schedule.weekdays,
        waitlistEnabled: schedule.waitlistEnabled,
        capacityDisplayMode: schedule.capacityDisplayMode,
        timezone: schedule.timezone,
      };
      const seriesRes = await fetch("/api/appointments/service-booking/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schedule.seriesId || undefined,
          name: form.name.trim(),
          description: form.description,
          appointmentTypeId: savedTypeId,
          capacity: form.groupCapacity || 10,
          staffId,
          locationId,
          recurrenceRule,
          active: form.enabled,
        }),
      });
      if (!seriesRes.ok) return;
      const seriesJson = await seriesRes.json();
      const seriesId = (seriesJson.data?.id || seriesJson.id) as string;
      const payloads = buildOccurrencePayloads({
        ...schedule,
        durationMinutes: form.durationMinutes,
      });
      if (wasNewSeries && payloads.length > 0) {
        await fetch("/api/appointments/service-booking/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "occurrences",
            seriesId,
            occurrences: payloads.map((p) => ({
              ...p,
              capacity: form.groupCapacity,
            })),
          }),
        });
      }
      setSchedule((s) => ({ ...s, seriesId }));
    },
    [form, schedule],
  );

  const save = useCallback(async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError(`${isWorkshop ? "Event" : "Class"} name is required`);
      return null;
    }
    setSaving(true);
    setError("");
    const segment = segmentById(segmentId);
    const payload = buildSavePayload({
      ...form,
      bookingTypeKind: "CLASS",
      classPresentation: segment.classPresentation ?? "recurring_class",
      groupBookingEnabled: true,
      groupCapacity: form.groupCapacity || segmentPatchCapacity(segment),
    });
    const res = await fetch(
      isCreating ? "/api/appointments/types" : `/api/appointments/types/${typeId}`,
      {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      setSaving(false);
      return null;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    await syncSeries(saved.id);
    setSaving(false);
    setForm(formStateFromApiType(saved));
    clearDraft(segmentId, typeId);
    clearDraft(segmentId, saved.id);
    const basePath =
      segmentId === "workshops" ? "/appointments/types/workshops" : "/appointments/types/classes";
    if (isCreating) {
      router.replace(`${basePath}/${saved.id}`);
    }
    return saved.id;
  }, [form, isCreating, isWorkshop, router, segmentId, syncSeries, typeId]);

  const bookingLink = useMemo(() => {
    if (!workspaceSlug || !typeId || typeof window === "undefined") return null;
    if (isWorkshop) {
      return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/classes`;
    }
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/classes`;
  }, [isWorkshop, typeId, workspaceSlug]);

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

  const duplicate = useCallback(async () => {
    if (!typeId) return;
    setSaving(true);
    const segment = segmentById(segmentId);
    const payload = buildSavePayload({
      ...form,
      name: `${form.name.trim()} (copy)`,
      bookingTypeKind: "CLASS",
      classPresentation: segment.classPresentation ?? "recurring_class",
    });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      const basePath =
        segmentId === "workshops" ? "/appointments/types/workshops" : "/appointments/types/classes";
      router.push(`${basePath}/${(json.data as ApiAppointmentType).id}`);
    }
  }, [form, router, segmentId, typeId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      updateForm("enabled", enabled);
      if (!typeId) return;
      setSaving(true);
      const nextForm = { ...form, enabled };
      await fetch(`/api/appointments/types/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(nextForm)),
      });
      setSaving(false);
    },
    [form, typeId, updateForm],
  );

  const nextOccurrenceHref = useMemo(() => {
    if (!schedule.seriesId) return null;
    return null;
  }, [schedule.seriesId]);

  return {
    form,
    schedule,
    updateForm,
    updateSchedule,
    options,
    loading,
    failed,
    saving,
    error,
    isCreating,
    isWorkshop,
    bookingLink,
    copied,
    typeId,
    occurrencePreview,
    persistDraft,
    save,
    duplicate,
    setEnabled,
    copyBookingLink,
    previewBooking,
    nextOccurrenceHref,
  };
}

function segmentPatchCapacity(segment: ReturnType<typeof segmentById>): number {
  const patch = defaultConfigForSegment(segment);
  return patch.groupBooking?.capacity ?? 10;
}
