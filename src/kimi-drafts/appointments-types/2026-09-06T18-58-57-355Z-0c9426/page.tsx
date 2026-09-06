"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ExternalLink, AlertTriangle } from "lucide-react";
import TypeListPanel from "./components/TypeListPanel";
import TypeEditorPanel from "./components/TypeEditorPanel";
import PreviewPanel from "./components/PreviewPanel";
import StatusPanel from "./components/StatusPanel";
import BulkEditPanel from "./components/BulkEditPanel";
import EmptyState from "./components/EmptyState";
import DeleteTypeModal from "./components/DeleteTypeModal";
import ScheduleModal from "./components/ScheduleModal";
import BookingPageModal from "./components/BookingPageModal";
import {
  APPOINTMENT_TYPES,
  STAFF_OPTIONS,
  LOCATION_OPTIONS,
  PAYMENT_PROVIDERS,
  NAMED_SCHEDULES,
  TEAM_GROUPS,
  EMPTY_FORM,
  type AppointmentTypeItem,
  type AppointmentTypeFormState,
} from "./mock-data";
import "./reference.css";

function TypesSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-[#e9ebf1] mb-2" />
      <div className="h-4 w-80 rounded bg-[#eef0f4] mb-6" />
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-[300px] h-[480px] rounded-xl bg-white border border-[#ecedf2]" />
        <div className="flex-1 h-[480px] rounded-xl bg-white border border-[#ecedf2]" />
        <div className="hidden xl:block w-[300px] h-[480px] rounded-xl bg-white border border-[#ecedf2]" />
      </div>
    </div>
  );
}

function TypesLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="panel max-w-xl mx-auto mt-10">
      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fef3f2] text-[#d92d20]">
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-[15px] font-semibold text-[#1a1d29]">We couldn&apos;t load booking types</h3>
        <p className="text-[13px] text-[#667085] mt-1.5 leading-relaxed">
          Something went wrong while fetching your services and booking settings. Your data is safe —
          try loading the page again.
        </p>
        <button
          type="button"
          className="btn-brand mt-5 h-9 px-4 rounded-lg text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98]"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function ReferencePage() {
  const [types, setTypes] = useState<AppointmentTypeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [bookingPageOpen, setBookingPageOpen] = useState(false);

  const workspaceSlug = "brightline-dental";
  const bookingBaseUrl = `transovo.com/book/${workspaceSlug}`;

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    const t = setTimeout(() => {
      setTypes(APPOINTMENT_TYPES);
      setSelectedId(APPOINTMENT_TYPES[0]?.id ?? null);
      setLoading(false);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => types.find((t) => t.id === selectedId) ?? null, [types, selectedId]);

  const selectedScheduleName = useMemo(
    () => NAMED_SCHEDULES.find((s) => s.id === form.namedScheduleId)?.name ?? "Standard Hours",
    [form.namedScheduleId],
  );

  const visibleTypes = useMemo(() => {
    return types.filter((t) => {
      if (!showInactive && !t.active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q);
      }
      return true;
    });
  }, [types, showInactive, searchQuery]);

  const loadFormFromType = useCallback((t: AppointmentTypeItem) => {
    setForm({
      ...EMPTY_FORM,
      name: t.name,
      durationMinutes: t.durationMin,
      bufferMinutes: t.bufferMin,
      description: t.description,
      location: t.location,
      priceDisplay: t.free ? "" : `$${t.price}`,
      showPriceOnBooking: !t.free,
      enabled: t.active,
      staffIds: ["s1", "s3"],
      paymentMode: t.free ? "none" : "full",
      paymentProvider: t.free ? "" : "stripe",
      paymentPriceCents: t.free ? 0 : (t.price ?? 0) * 100,
      bookingQuestions: t.questions.map((q) => ({
        id: q.id,
        label: q.label,
        type: q.type,
        required: q.required,
        options: q.type === "radio" || q.type === "select" ? ["Option 1", "Option 2"] : [],
      })),
    });
    setDirty(false);
    setError("");
  }, []);

  useEffect(() => {
    if (!loading && selected && !isCreating && !dirty && form.name === "") {
      loadFormFromType(selected);
    }
  }, [loading, selected, isCreating, dirty, form.name, loadFormFromType]);

  const onSelectType = useCallback(
    (id: string) => {
      setIsCreating(false);
      setSelectedId(id);
      const t = types.find((x) => x.id === id);
      if (t) loadFormFromType(t);
    },
    [types, loadFormFromType],
  );

  const onNewType = useCallback(() => {
    setIsCreating(true);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setDirty(false);
    setError("");
  }, []);

  const onCancel = useCallback(() => {
    setIsCreating(false);
    if (types[0]) {
      setSelectedId(types[0].id);
      loadFormFromType(types[0]);
    }
  }, [types, loadFormFromType]);

  const onFormChange = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setDirty(true);
    },
    [],
  );

  const onSave = useCallback(() => {
    setError("");
    if (!form.name.trim()) {
      setError("Enter a name for this booking type.");
      return;
    }
    if (form.durationMinutes < 5) {
      setError("Duration must be at least 5 minutes.");
      return;
    }
    if (form.redirectAfterBookingEnabled && !form.redirectAfterBookingUrl.trim()) {
      setError("Enter a redirect URL or turn off the post-booking redirect.");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      if (isCreating) {
        const id = `t${Date.now()}`;
        const newType: AppointmentTypeItem = {
          id,
          name: form.name.trim(),
          durationMin: form.durationMinutes,
          price: form.paymentMode === "none" ? null : Math.round(form.paymentPriceCents / 100),
          free: form.paymentMode === "none",
          active: form.enabled,
          isLive: form.enabled,
          color: "text-indigo-600",
          bg: "bg-indigo-100",
          description: form.description,
          location: form.location,
          bufferMin: form.bufferMinutes,
          slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          questions: form.bookingQuestions.map((q) => ({
            id: q.id,
            label: q.label,
            type: q.type,
            required: q.required,
          })),
        };
        setTypes((ts) => [...ts, newType]);
        setSelectedId(id);
        setIsCreating(false);
      } else if (selectedId) {
        setTypes((ts) =>
          ts.map((t) =>
            t.id === selectedId
              ? {
                  ...t,
                  name: form.name.trim(),
                  durationMin: form.durationMinutes,
                  bufferMin: form.bufferMinutes,
                  description: form.description,
                  location: form.location,
                  active: form.enabled,
                  isLive: form.enabled,
                  free: form.paymentMode === "none",
                  price: form.paymentMode === "none" ? null : Math.round(form.paymentPriceCents / 100),
                  questions: form.bookingQuestions.map((q) => ({
                    id: q.id,
                    label: q.label,
                    type: q.type,
                    required: q.required,
                  })),
                }
              : t,
          ),
        );
      }
      setSaving(false);
      setDirty(false);
    }, 600);
  }, [form, isCreating, selectedId]);

  const onDeleteConfirm = useCallback(() => {
    if (!selectedId) return;
    setTypes((ts) => {
      const next = ts.filter((t) => t.id !== selectedId);
      const fallback = next[0] ?? null;
      setSelectedId(fallback?.id ?? null);
      if (fallback) loadFormFromType(fallback);
      else {
        setForm(EMPTY_FORM);
        setDirty(false);
      }
      return next;
    });
    setDeleteOpen(false);
  }, [selectedId, loadFormFromType]);

  const onToggleActive = useCallback(
    (active: boolean) => {
      if (!selectedId) return;
      setTypes((ts) => ts.map((t) => (t.id === selectedId ? { ...t, active, isLive: active } : t)));
      setForm((f) => ({ ...f, enabled: active }));
    },
    [selectedId],
  );

  const onCopyLink = useCallback((id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  }, []);

  const onMoveType = useCallback((id: string, direction: "up" | "down") => {
    setTypes((ts) => {
      const idx = ts.findIndex((t) => t.id === id);
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= ts.length) return ts;
      const next = [...ts];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const onBulkApplied = useCallback(() => {
    // Mock: bulk changes applied — nothing else to recompute in sandbox.
  }, []);

  return (
    <div className="reference-root">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[30px] font-bold tracking-tight text-[#1a1d29]">
              Booking Types
            </h1>
            <p className="text-[13.5px] leading-[20px] text-[#8a8fa3] mt-1">
              Manage the services you offer and how customers can book with you.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
            <button
              type="button"
              className="btn-secondary flex items-center gap-1.5 text-[13px] font-medium h-9 px-3.5 rounded-lg"
              onClick={() => setBookingPageOpen(true)}
            >
              View booking page <ExternalLink size={13} className="text-[#8a8fa3]" />
            </button>
            <button
              type="button"
              className="btn-brand flex items-center gap-1.5 text-[13px] font-semibold h-9 px-4 rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98]"
              onClick={onNewType}
            >
              <Plus size={15} strokeWidth={2.5} /> New booking type
            </button>
          </div>
        </div>

        {loading ? (
          <TypesSkeleton />
        ) : failed ? (
          <TypesLoadError onRetry={load} />
        ) : types.length === 0 && !isCreating ? (
          <EmptyState onNewType={onNewType} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <div className="self-stretch flex w-full lg:w-[300px] shrink-0">
              <TypeListPanel
                types={visibleTypes}
                totalCount={types.length}
                selectedId={selectedId}
                searchQuery={searchQuery}
                onSelect={onSelectType}
                showInactive={showInactive}
                onToggleInactive={() => setShowInactive((v) => !v)}
                onSearchChange={setSearchQuery}
                onMoveType={onMoveType}
              />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <TypeEditorPanel
                form={form}
                isCreating={isCreating}
                saving={saving}
                error={error}
                dirty={dirty}
                staffOptions={STAFF_OPTIONS}
                locationOptions={LOCATION_OPTIONS}
                connectedPaymentProviders={PAYMENT_PROVIDERS}
                namedScheduleOptions={NAMED_SCHEDULES}
                teamGroupOptions={TEAM_GROUPS}
                onFormChange={onFormChange}
                onSave={onSave}
                onCancel={onCancel}
                onDeleteRequest={() => setDeleteOpen(true)}
                onEditSchedule={() => setScheduleOpen(true)}
              />
            </div>
            {selected && !isCreating ? (
              <div className="w-full lg:w-[300px] shrink-0 space-y-4">
                <PreviewPanel type={selected} />
                <StatusPanel
                  type={selected}
                  bookingBaseUrl={bookingBaseUrl}
                  copied={copiedId === selected.id}
                  onToggleActive={onToggleActive}
                  onCopyLink={() => onCopyLink(selected.id)}
                  onOpenPage={() => setBookingPageOpen(true)}
                />
              </div>
            ) : null}
          </div>
        )}

        {!loading && !failed && types.length > 0 ? (
          <BulkEditPanel types={types.map((t) => ({ id: t.id, name: t.name }))} onApplied={onBulkApplied} />
        ) : null}
      </div>

      {deleteOpen && selected ? (
        <DeleteTypeModal
          typeName={selected.name}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={onDeleteConfirm}
        />
      ) : null}

      {scheduleOpen ? (
        <ScheduleModal scheduleName={selectedScheduleName} onClose={() => setScheduleOpen(false)} />
      ) : null}

      {bookingPageOpen ? (
        <BookingPageModal
          type={selected}
          bookingBaseUrl={bookingBaseUrl}
          onClose={() => setBookingPageOpen(false)}
        />
      ) : null}
    </div>
  );
}
