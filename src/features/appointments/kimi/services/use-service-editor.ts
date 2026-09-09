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
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import { isServiceRow } from "@/lib/appointments/services/service-display";

export type ServiceEditorOptions = {
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
  resourceOptions: Array<{ id: string; name: string; quantity?: number }>;
  addOnOptions: Array<{ id: string; name: string; priceCents?: number }>;
  categoryOptions: Array<{ id: string; name: string }>;
  intakeFormOptions: Array<{ id: string; name: string; active?: boolean }>;
};

function draftStorageKey(serviceId: string | null): string {
  return `transovo:service-editor:${serviceId || "new"}`;
}

function readStoredDraft(serviceId: string | null): AppointmentTypeFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftStorageKey(serviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { form?: AppointmentTypeFormState };
    return parsed.form ?? null;
  } catch {
    return null;
  }
}

function writeStoredDraft(serviceId: string | null, form: AppointmentTypeFormState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      draftStorageKey(serviceId),
      JSON.stringify({ savedAt: Date.now(), form }),
    );
  } catch {
    // ignore quota errors
  }
}

function clearStoredDraft(serviceId: string | null): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftStorageKey(serviceId));
}

export function useServiceEditor(serviceId: string | null) {
  const router = useRouter();
  const isCreating = !serviceId;

  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ServiceEditorOptions>({
    staffOptions: [],
    locationOptions: [],
    connectedPaymentProviders: [],
    namedScheduleOptions: [],
    resourceOptions: [],
    addOnOptions: [],
    categoryOptions: [],
    intakeFormOptions: [],
  });
  const draftRestoredRef = useRef(false);

  const initCreateForm = useCallback(() => {
    const segment = segmentById("services");
    const kindPatch = defaultConfigPatchForKind("SERVICE");
    const segmentPatch = defaultConfigForSegment(segment);
    const stored = readStoredDraft(null);
    if (stored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setForm({ ...stored, bookingTypeKind: "SERVICE" });
      return;
    }
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "SERVICE",
      classPresentation: "recurring_class",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [
        typesRes,
        settingsRes,
        paymentsRes,
        resourcesRes,
        addOnsRes,
        categoriesRes,
        intakeRes,
      ] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
        fetch("/api/merchant-payments/status"),
        fetch("/api/appointments/service-booking/resources"),
        fetch("/api/appointments/service-booking/add-ons"),
        fetch("/api/appointments/service-booking/categories"),
        fetch("/api/appointments/service-booking/intake-forms?targetKind=appointment"),
      ]);
      if (!typesRes.ok || !settingsRes.ok) throw new Error("load failed");

      const typesJson = await typesRes.json();
      const settingsJson = await settingsRes.json();
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { data: { connections: [] } };

      const platform = settingsJson.data?.platform || settingsJson.platform || {};
      setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
      setBookingEnabled(Boolean(settingsJson.data?.bookingEnabled ?? settingsJson.bookingEnabled));

      const providers = (paymentsJson.data?.connections || paymentsJson.providers || [])
        .filter((c: { canAcceptPayments?: boolean; connected?: boolean }) =>
          c.canAcceptPayments || c.connected,
        )
        .map((c: { provider: string }) => ({
          provider: c.provider.toLowerCase() as "stripe" | "square",
          label: c.provider === "STRIPE" || c.provider === "stripe" ? "Stripe" : "Square",
        }));

      const resourceOptions =
        resourcesRes.ok
          ? ((await resourcesRes.json()).data || [])
              .filter((r: { active?: boolean }) => r.active !== false)
              .map((r: { id: string; name: string; quantity?: number }) => ({
                id: r.id,
                name: r.name,
                quantity: r.quantity,
              }))
          : [];

      const addOnOptions =
        addOnsRes.ok
          ? ((await addOnsRes.json()).data || [])
              .filter((a: { active?: boolean }) => a.active !== false)
              .map((a: { id: string; name: string; priceCents?: number }) => ({
                id: a.id,
                name: a.name,
                priceCents: a.priceCents,
              }))
          : [];

      const categoriesJson = categoriesRes.ok ? await categoriesRes.json() : null;
      const categoryOptions = categoriesJson
        ? ((categoriesJson.data || categoriesJson || []) as Array<{ id: string; name: string; active?: boolean }>)
            .filter((c) => c.active !== false)
            .map((c) => ({ id: c.id, name: c.name }))
        : [];

      const intakeJson = intakeRes.ok ? await intakeRes.json() : null;
      const intakeFormOptions = intakeJson
        ? ((intakeJson.data || intakeJson || []) as Array<{ id: string; name: string; active?: boolean }>).map(
            (f) => ({ id: f.id, name: f.name, active: f.active }),
          )
        : [];

      setOptions({
        staffOptions: (platform.staff || [])
          .filter((s: { active?: boolean }) => s.active !== false)
          .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        locationOptions: (platform.locations || [])
          .filter((l: { active?: boolean }) => l.active !== false)
          .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
        connectedPaymentProviders: providers,
        namedScheduleOptions: (platform.namedSchedules || []).map((s: { id: string; name: string }) => ({
          id: s.id,
          name: s.name,
        })),
        resourceOptions,
        addOnOptions,
        categoryOptions,
        intakeFormOptions,
      });

      if (isCreating) {
        initCreateForm();
      } else {
        const rows = (typesJson.data || []) as ApiAppointmentType[];
        const row = rows.find((t) => t.id === serviceId);
        if (!row || !isServiceRow(row)) throw new Error("not a service");
        const stored = readStoredDraft(serviceId);
        if (stored && !draftRestoredRef.current) {
          draftRestoredRef.current = true;
          setForm({ ...stored, bookingTypeKind: "SERVICE" });
        } else {
          setForm(formStateFromApiType(row));
        }
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initCreateForm, isCreating, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        writeStoredDraft(serviceId, next);
        return next;
      });
      setError("");
    },
    [serviceId],
  );

  const persistDraft = useCallback(() => {
    writeStoredDraft(serviceId, form);
  }, [form, serviceId]);

  const bookingBaseUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}`;
  }, [workspaceSlug]);

  const bookingLink = useMemo(() => {
    if (!bookingBaseUrl || !serviceId) return null;
    return `${bookingBaseUrl}/${encodeURIComponent(serviceId)}`;
  }, [bookingBaseUrl, serviceId]);

  const save = useCallback(async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError("Service name is required");
      return null;
    }
    setSaving(true);
    setError("");
    const payload = buildSavePayload({ ...form, bookingTypeKind: "SERVICE" });
    const res = await fetch(
      isCreating ? "/api/appointments/types" : `/api/appointments/types/${serviceId}`,
      {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save service");
      setSaving(false);
      return null;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    setSaving(false);
    setForm(formStateFromApiType(saved));
    clearStoredDraft(serviceId);
    clearStoredDraft(saved.id);
    if (isCreating) {
      router.replace(`/appointments/types/services/${saved.id}`);
    }
    return saved.id;
  }, [form, isCreating, router, serviceId]);

  const duplicate = useCallback(async () => {
    if (!serviceId) return;
    setSaving(true);
    const payload = buildSavePayload({
      ...form,
      name: `${form.name.trim()} (copy)`,
      bookingTypeKind: "SERVICE",
    });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/appointments/types/services/${(json.data as ApiAppointmentType).id}`);
    }
  }, [form, router, serviceId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      updateForm("enabled", enabled);
      if (!serviceId) return;
      setSaving(true);
      const nextForm = { ...form, enabled };
      await fetch(`/api/appointments/types/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(nextForm)),
      });
      setSaving(false);
    },
    [form, serviceId, updateForm],
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

  const refreshOptions = useCallback(async () => {
    await load();
  }, [load]);

  return {
    form,
    updateForm,
    options,
    loading,
    failed,
    saving,
    error,
    isCreating,
    bookingEnabled,
    bookingLink,
    copied,
    serviceId,
    load,
    save,
    duplicate,
    setEnabled,
    copyBookingLink,
    previewBooking,
    persistDraft,
    refreshOptions,
  };
}
