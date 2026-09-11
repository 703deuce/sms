"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppointmentTypesView from "@/components/appointments/kimi-ui/appointment-types/page";
import {
  buildSavePayload,
  emptyFormForBookingTypeKind,
  formStateFromApiType,
  mapApiTypesToItems,
  previewFromForm,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type {
  AppointmentTypeFormState,
  AppointmentTypeItem,
  AppointmentTypesPageActions,
  AppointmentTypesPageCopy,
  AppointmentTypesPageModel,
} from "@/features/appointments/kimi/appointment-types/types";
import type { BookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

function TypesLoading() {
  return (
    <div className="reference-root min-h-screen bg-[#f7f8fb] p-6 font-sans animate-pulse">
      <div className="h-8 w-64 rounded bg-gray-200 mb-6" />
      <div className="flex gap-5">
        <div className="w-[300px] h-[520px] rounded-xl bg-white border border-[#ecedf2]" />
        <div className="flex-1 h-[520px] rounded-xl bg-white border border-[#ecedf2]" />
        <div className="w-[300px] h-[520px] rounded-xl bg-white border border-[#ecedf2]" />
      </div>
    </div>
  );
}

function TypesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="reference-root min-h-screen bg-[#f7f8fb] p-6 font-sans flex items-center justify-center">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load appointment types</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your services and booking settings.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export type AppointmentTypesConnectedProps = {
  /** When set, list and create are scoped to this booking type kind; archetype picker is hidden. */
  lockedKind?: BookingTypeKind;
  pageCopy?: Partial<AppointmentTypesPageCopy>;
};

const DEFAULT_PAGE_COPY: AppointmentTypesPageCopy = {
  pageTitle: "Appointment Types",
  pageDescription: "Manage the services you offer and how customers can book with you.",
  createButtonLabel: "New appointment type",
  listPanelTitle: "All appointment types",
  listEmptyMessage: "No appointment types match.",
  editorBackLabel: "Back to all types",
  hideKindPicker: false,
};

export function AppointmentTypesConnected({
  lockedKind,
  pageCopy: pageCopyOverride,
}: AppointmentTypesConnectedProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkTypeId = searchParams.get("id");
  const pageCopy: AppointmentTypesPageCopy = {
    ...DEFAULT_PAGE_COPY,
    ...pageCopyOverride,
    hideKindPicker: pageCopyOverride?.hideKindPicker ?? Boolean(lockedKind),
  };
  const [apiTypes, setApiTypes] = useState<ApiAppointmentType[]>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<AppointmentTypeFormState>(() =>
    emptyFormForBookingTypeKind(lockedKind ?? "SERVICE"),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [connectedPaymentProviders, setConnectedPaymentProviders] = useState<
    Array<{ provider: "stripe" | "square"; label: string }>
  >([]);
  const [namedScheduleOptions, setNamedScheduleOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [teamGroupOptions, setTeamGroupOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [resourceOptions, setResourceOptions] = useState<
    Array<{ id: string; name: string; quantity?: number }>
  >([]);
  const [addOnOptions, setAddOnOptions] = useState<
    Array<{ id: string; name: string; priceCents?: number }>
  >([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [intakeFormOptions, setIntakeFormOptions] = useState<
    Array<{ id: string; name: string; active?: boolean }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes, paymentsRes, groupsRes, resourcesRes, addOnsRes, categoriesRes, intakeRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
        fetch("/api/merchant-payments/status"),
        fetch("/api/appointments/team-pages?kind=groups"),
        fetch("/api/appointments/service-booking/resources"),
        fetch("/api/appointments/service-booking/add-ons"),
        fetch("/api/appointments/service-booking/categories"),
        fetch("/api/appointments/service-booking/intake-forms?targetKind=appointment"),
      ]);
      if (!typesRes.ok) throw new Error("types failed");
      const typesJson = await typesRes.json();
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { workspace: null, data: null };
      const rows = (typesJson.data || []) as ApiAppointmentType[];
      setApiTypes(rows);
      setWorkspaceSlug(settingsJson.workspace?.slug || "");
      setBookingEnabled(Boolean(settingsJson.data?.bookingEnabled));
      setNamedScheduleOptions(
        ((settingsJson.data?.namedSchedules || []) as Array<{ id: string; name: string }>).map(
          (s) => ({ id: s.id, name: s.name }),
        ),
      );
      if (groupsRes.ok) {
        const groupsJson = await groupsRes.json();
        setTeamGroupOptions(
          ((groupsJson.data || []) as Array<{ id: string; name: string }>).map((g) => ({
            id: g.id,
            name: g.name,
          })),
        );
      }
      if (resourcesRes.ok) {
        const resourcesJson = await resourcesRes.json();
        setResourceOptions(
          ((resourcesJson.data || []) as Array<{ id: string; name: string; quantity?: number; active?: boolean }>)
            .filter((r) => r.active !== false)
            .map((r) => ({ id: r.id, name: r.name, quantity: r.quantity })),
        );
      }
      if (addOnsRes.ok) {
        const addOnsJson = await addOnsRes.json();
        setAddOnOptions(
          ((addOnsJson.data || []) as Array<{ id: string; name: string; priceCents?: number; active?: boolean }>)
            .filter((a) => a.active !== false)
            .map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents })),
        );
      }
      if (categoriesRes.ok) {
        const categoriesJson = await categoriesRes.json();
        setCategoryOptions(
          ((categoriesJson.data || categoriesJson || []) as Array<{ id: string; name: string; active?: boolean }>)
            .filter((c) => c.active !== false)
            .map((c) => ({ id: c.id, name: c.name })),
        );
      }
      if (intakeRes.ok) {
        const intakeJson = await intakeRes.json();
        setIntakeFormOptions(
          ((intakeJson.data || intakeJson || []) as Array<{ id: string; name: string; active?: boolean }>).map(
            (f) => ({ id: f.id, name: f.name, active: f.active }),
          ),
        );
      }
      const staff = (settingsJson.data?.staff || []) as Array<{ id: string; name: string; active?: boolean }>;
      const locations = (settingsJson.data?.locations || []) as Array<{ id: string; name: string; active?: boolean }>;
      setStaffOptions(staff.filter((s) => s.active !== false && s.name).map((s) => ({ id: s.id, name: s.name })));
      setLocationOptions(locations.filter((l) => l.active !== false && l.name).map((l) => ({ id: l.id, name: l.name })));
      if (paymentsRes.ok) {
        const paymentsJson = await paymentsRes.json();
        const providers = (paymentsJson.data?.connections || [])
          .filter((c: { canAcceptPayments: boolean }) => c.canAcceptPayments)
          .map((c: { provider: string }) => ({
            provider: c.provider.toLowerCase() as "stripe" | "square",
            label: c.provider === "STRIPE" ? "Stripe" : "Square",
          }));
        setConnectedPaymentProviders(providers);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scopedApiTypes = useMemo(() => {
    if (!lockedKind) return apiTypes;
    return apiTypes.filter((row) => resolveBookingTypeKind(row.config) === lockedKind);
  }, [apiTypes, lockedKind]);

  useEffect(() => {
    if (loading || isCreating) return;
    if (deepLinkTypeId) {
      const row = scopedApiTypes.find((t) => t.id === deepLinkTypeId);
      if (row && selectedId !== deepLinkTypeId) {
        setSelectedId(deepLinkTypeId);
        setForm(formStateFromApiType(row));
      }
      return;
    }
    if (scopedApiTypes.length > 0 && !selectedId) {
      setSelectedId(scopedApiTypes[0].id);
      setForm(formStateFromApiType(scopedApiTypes[0]));
    }
  }, [deepLinkTypeId, scopedApiTypes, isCreating, loading, selectedId]);

  const types = useMemo(() => {
    const mapped = mapApiTypesToItems(apiTypes, { workspaceSlug, bookingEnabled });
    if (!lockedKind) return mapped;
    return mapped.filter((type) => type.kind === lockedKind);
  }, [apiTypes, bookingEnabled, lockedKind, workspaceSlug]);

  const visibleTypes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = types.filter((type) => {
      if (!showInactive && !type.active) return false;
      if (!q) return true;
      return type.name.toLowerCase().includes(q);
    });
    return filtered.sort((a, b) => {
      const aOrder = apiTypes.find((t) => t.id === a.id)?.config?.displayOrder ?? 999;
      const bOrder = apiTypes.find((t) => t.id === b.id)?.config?.displayOrder ?? 999;
      return aOrder - bOrder;
    });
  }, [searchQuery, showInactive, types, apiTypes]);

  const reorderTypes = useCallback(
    async (orderedIds: string[]) => {
      await fetch("/api/appointments/types/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedIds }),
      });
      await load();
    },
    [load],
  );

  const moveType = useCallback(
    (id: string, direction: "up" | "down") => {
      const ids = visibleTypes.map((t) => t.id);
      const idx = ids.indexOf(id);
      if (idx < 0) return;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= ids.length) return;
      const next = [...ids];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      void reorderTypes(next);
    },
    [reorderTypes, visibleTypes],
  );

  const selected = useMemo(
    () => types.find((type) => type.id === selectedId) ?? null,
    [selectedId, types],
  );

  const bookingBaseUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}`;
  }, [workspaceSlug]);

  const updateForm = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setError("");
    },
    [],
  );

  const selectType = useCallback(
    (id: string) => {
      const row = apiTypes.find((type) => type.id === id);
      if (!row) return;
      setSelectedId(id);
      setIsCreating(false);
      setForm(formStateFromApiType(row));
      setError("");
    },
    [apiTypes],
  );

  const startCreate = useCallback(() => {
    setSelectedId(null);
    setIsCreating(true);
    setForm(lockedKind ? emptyFormForBookingTypeKind(lockedKind) : emptyFormForBookingTypeKind("SERVICE"));
    setError("");
  }, [lockedKind]);

  const resetEditor = useCallback(() => {
    if (selectedId) {
      const row = apiTypes.find((type) => type.id === selectedId);
      if (row) setForm(formStateFromApiType(row));
      setIsCreating(false);
      return;
    }
    if (types[0]) {
      setSelectedId(types[0].id);
      const row = apiTypes.find((type) => type.id === types[0].id);
      if (row) setForm(formStateFromApiType(row));
      setIsCreating(false);
    }
  }, [apiTypes, selectedId, types]);

  const save = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    const editingId = isCreating ? null : selectedId;
    const payloadForm =
      lockedKind && form.bookingTypeKind !== lockedKind
        ? { ...form, bookingTypeKind: lockedKind }
        : form;
    const res = await fetch(
      editingId ? `/api/appointments/types/${editingId}` : "/api/appointments/types",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(payloadForm)),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save appointment type");
      setSaving(false);
      return;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    setSaving(false);
    setIsCreating(false);
    setSelectedId(saved.id);
    setForm(formStateFromApiType(saved));
    await load();
  }, [form, isCreating, load, lockedKind, selectedId]);

  const toggleActive = useCallback(
    async (active: boolean) => {
      if (!selectedId) return;
      updateForm("enabled", active);
      const nextForm = { ...form, enabled: active };
      setSaving(true);
      const res = await fetch(`/api/appointments/types/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(nextForm)),
      });
      setSaving(false);
      if (res.ok) await load();
    },
    [form, load, selectedId, updateForm],
  );

  const copyLink = useCallback(
    async (id: string) => {
      if (!bookingBaseUrl) return;
      const url = `${bookingBaseUrl}/${encodeURIComponent(id)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
      } catch {
        // clipboard unavailable
      }
    },
    [bookingBaseUrl],
  );

  const model: AppointmentTypesPageModel | null = useMemo(() => {
    if (loading || failed) return null;
    const preview = previewFromForm(form, selected);
    const previewItem: AppointmentTypeItem = selected
      ? {
          ...selected,
          name: preview.name,
          durationMin: preview.durationMin,
          price: preview.price,
          free: preview.free,
          description: preview.description,
          location: preview.location,
          color: preview.color,
          bg: preview.bg,
          questions: preview.questions,
          active: form.enabled,
        }
      : {
          id: "new",
          kind: form.bookingTypeKind,
          name: preview.name,
          durationMin: preview.durationMin,
          price: preview.price,
          free: preview.free,
          active: form.enabled,
          isLive: false,
          color: preview.color,
          bg: preview.bg,
          description: preview.description,
          location: preview.location,
          bufferMin: form.bufferMinutes,
          slug: "new-type",
          created: "—",
          updated: "—",
          questions: preview.questions,
        };

    return {
      types,
      visibleTypes,
      selectedId,
      selected: previewItem,
      showInactive,
      form,
      isCreating,
      workspaceSlug,
      bookingEnabled,
      bookingBaseUrl,
      searchQuery,
      saving,
      error,
      copiedId,
      staffOptions,
      locationOptions,
      connectedPaymentProviders,
      namedScheduleOptions,
      teamGroupOptions,
      resourceOptions,
      addOnOptions,
      categoryOptions,
      intakeFormOptions,
      pageCopy,
    };
  }, [
    bookingBaseUrl,
    bookingEnabled,
    copiedId,
    error,
    failed,
    form,
    loading,
    locationOptions,
    selected,
    selectedId,
    showInactive,
    staffOptions,
    connectedPaymentProviders,
    namedScheduleOptions,
    teamGroupOptions,
    resourceOptions,
    addOnOptions,
    categoryOptions,
    intakeFormOptions,
    types,
    visibleTypes,
    workspaceSlug,
    isCreating,
    searchQuery,
    saving,
    pageCopy,
  ]);

  const actions: AppointmentTypesPageActions = useMemo(
    () => ({
      onSelectType: selectType,
      onNewType: startCreate,
      onBackToList: resetEditor,
      onToggleShowInactive: () => setShowInactive((v) => !v),
      onSearchChange: setSearchQuery,
      onFormChange: updateForm,
      onSave: save,
      onCancel: resetEditor,
      onToggleActive: toggleActive,
      onCopyLink: copyLink,
      onViewBookingPage: () => {
        if (bookingBaseUrl) window.open(bookingBaseUrl, "_blank");
      },
      onManageAvailability: () => router.push("/appointments/availability"),
      onManageStaff: () => router.push("/appointments/staff"),
      onManageLocations: () => router.push("/appointments/locations"),
      onReorderTypes: reorderTypes,
      onMoveType: moveType,
      onRetry: load,
    }),
    [bookingBaseUrl, copyLink, load, moveType, resetEditor, router, save, selectType, startCreate, toggleActive, updateForm, reorderTypes],
  );

  if (loading) return <TypesLoading />;
  if (failed || !model) return <TypesError onRetry={load} />;

  return <AppointmentTypesView model={model} actions={actions} />;
}
