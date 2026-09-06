"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, ExternalLink } from "lucide-react";
import TypeListPanel from "./components/TypeListPanel";
import TypeEditorPanel from "./components/TypeEditorPanel";
import PreviewPanel from "./components/PreviewPanel";
import StatusPanel from "./components/StatusPanel";
import BulkEditPanel from "./components/BulkEditPanel";
import EmptyState from "./components/EmptyState";
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

export default function ReferencePage() {
  const [types, setTypes] = useState<AppointmentTypeItem[]>(APPOINTMENT_TYPES);
  const [selectedId, setSelectedId] = useState<string | null>(APPOINTMENT_TYPES[0]?.id ?? null);
  const [showInactive, setShowInactive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const workspaceSlug = "brightline-dental";
  const bookingBaseUrl = `transovo.com/book/${workspaceSlug}`;

  const selected = useMemo(() => types.find((t) => t.id === selectedId) ?? null, [types, selectedId]);

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
      name: t.name,
      durationMinutes: t.durationMin,
      bufferMinutes: t.bufferMin,
      description: t.description,
      location: t.location,
      locationId: "",
      priceDisplay: t.free ? "" : `$${t.price}`,
      showPriceOnBooking: !t.free,
      bookingHours: "Mon–Fri 9:00 AM – 5:00 PM",
      minimumBookingNoticeMinutes: 60,
      maximumBookingDaysAhead: 14,
      enabled: t.active,
      staffAssignment: "any_eligible",
      staffIds: ["s1", "s3"],
      cancellationPolicy: "anytime",
      reschedulePolicy: "anytime",
      paymentMode: t.free ? "none" : "full",
      paymentProvider: t.free ? "" : "stripe",
      paymentPriceCents: t.free ? 0 : (t.price ?? 0) * 100,
      groupBookingEnabled: false,
      groupCapacity: 1,
      recurringEnabled: false,
      visibility: "public",
      bookingApprovalRequired: false,
      namedScheduleId: "ns1",
      ownerTeamId: "",
    });
    setDirty(false);
    setError("");
  }, []);

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

  const onFormChange = useCallback(<K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }, []);

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
          questions: [],
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
                }
              : t,
          ),
        );
      }
      setSaving(false);
      setDirty(false);
    }, 600);
  }, [form, isCreating, selectedId]);

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

  return (
    <div className="reference-root">
      <div className="max-w-[1560px] mx-auto px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-5">
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

        {types.length === 0 ? (
          <EmptyState onNewType={onNewType} />
        ) : (
          <div className="flex gap-5 items-start">
            <div className="self-stretch flex w-[300px] shrink-0">
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
            <div className="flex-1 min-w-0">
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
              />
            </div>
            {selected && !isCreating ? (
              <div className="w-[300px] shrink-0 space-y-4">
                <PreviewPanel type={selected} />
                <StatusPanel
                  type={selected}
                  bookingBaseUrl={bookingBaseUrl}
                  copied={copiedId === selected.id}
                  onToggleActive={onToggleActive}
                  onCopyLink={() => onCopyLink(selected.id)}
                />
              </div>
            ) : null}
          </div>
        )}

        <BulkEditPanel types={types.map((t) => ({ id: t.id, name: t.name }))} onApplied={() => {}} />
      </div>
    </div>
  );
}
