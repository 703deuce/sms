"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Briefcase,
  Building2,
  Car,
  Check,
  ClipboardCheck,
  Clock,
  CreditCard,
  Gift,
  MapPin,
  Phone,
  Plus,
  Store,
  Tag,
  UserRound,
  Video,
  Wallet,
} from "lucide-react";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import { formatDurationMinutes } from "@/lib/appointments/duration-display";
import {
  ChoiceCard,
  Field,
  NumberField,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import {
  APPOINTMENTS_SERVICES_ROUTES,
  type ServicesWorkspaceRoutes,
} from "@/lib/appointments/bookable-workspace-routes";
import { SchedulingWizardShell } from "@/components/appointments/scheduling-opus/scheduling-wizard-shell";
import { ServiceLivePreview } from "@/components/appointments/scheduling-opus/service-live-preview";
import { OpusCoverImageUploader } from "@/components/appointments/scheduling-opus/opus-cover-image-uploader";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "basics", label: "Basics", icon: Briefcase },
  { id: "time", label: "Time & place", icon: Clock },
  { id: "price", label: "Price", icon: Wallet },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

const LOCATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  office: Building2,
  store: Store,
  branch: Building2,
  customer: Car,
  phone: Phone,
  video: Video,
  transovo_video: Video,
  custom: MapPin,
};

type StaffRow = { id: string; name: string; role?: string };
type LocationRow = { id: string; name: string; kind?: string; address?: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function priceSummary(form: AppointmentTypeFormState): string {
  if (form.paymentPriceCents <= 0) return "Free";
  const amount = `$${(form.paymentPriceCents / 100).toFixed(2)}`;
  if (form.paymentMode === "full") return `${amount} · paid at booking`;
  if (form.paymentMode === "deposit") return `${amount} · deposit at booking`;
  return `${amount} · paid in person`;
}

export function CreateServiceWizard({
  routes = APPOINTMENTS_SERVICES_ROUTES,
}: {
  routes?: ServicesWorkspaceRoutes;
} = {}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [staffOptions, setStaffOptions] = useState<StaffRow[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationRow[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [providers, setProviders] = useState<Array<{ provider: "stripe" | "square"; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  useEffect(() => {
    const segment = segmentById("services");
    const kindPatch = defaultConfigPatchForKind("SERVICE");
    const segmentPatch = defaultConfigForSegment(segment);
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "SERVICE",
      classPresentation: "recurring_class",
      durationMinutes: 60,
      groupBookingEnabled: false,
      groupCapacity: 1,
      recurringEnabled: false,
      paymentMode: "none",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);

    void Promise.all([
      fetch("/api/appointments/settings").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/appointments/service-booking/categories").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/merchant-payments/status").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([settings, categories, payments]) => {
        const platform = settings?.data || {};
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string; role?: string }) => ({
              id: s.id,
              name: s.name,
              role: s.role,
            })),
        );
        setLocationOptions(
          (platform.locations || [])
            .filter((l: { active?: boolean }) => l.active !== false)
            .map((l: { id: string; name: string; kind?: string; address?: string }) => ({
              id: l.id,
              name: l.name,
              kind: l.kind,
              address: l.address,
            })),
        );
        setCategoryOptions(
          ((categories?.data || []) as Array<{ id: string; name: string; active?: boolean }>)
            .filter((c) => c.active !== false)
            .map((c) => ({ id: c.id, name: c.name })),
        );
        setProviders(
          ((payments?.data?.connections || []) as Array<{
            provider: string;
            canAcceptPayments?: boolean;
            connected?: boolean;
          }>)
            .filter((c) => c.canAcceptPayments || c.connected)
            .map((c) => ({
              provider: c.provider.toLowerCase() as "stripe" | "square",
              label: c.provider.toLowerCase() === "stripe" ? "Stripe" : "Square",
            })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setError("");
    },
    [],
  );

  const staffNames = useMemo(
    () => new Map(staffOptions.map((s) => [s.id, s.name])),
    [staffOptions],
  );
  const locationNames = useMemo(
    () => new Map(locationOptions.map((l) => [l.id, l.name])),
    [locationOptions],
  );
  const categoryName = useMemo(
    () => categoryOptions.find((c) => c.id === form.categoryId)?.name || "",
    [categoryOptions, form.categoryId],
  );

  const stepError = useMemo(() => {
    if (step === 0 && !form.name.trim()) return "Give this service a name.";
    if (step === 1 && form.durationMinutes < 5) return "Duration must be at least 5 minutes.";
    if (step === 2 && form.paymentMode !== "none" && form.paymentPriceCents <= 0) {
      return "Set a price above $0 to collect payment.";
    }
    if (step === 2 && form.paymentMode !== "none" && !form.paymentProvider) {
      return "Choose which connected provider collects the payment.";
    }
    return null;
  }, [form, step]);

  async function addStaffInline() {
    const name = inlineName.trim();
    if (!name) return;
    setInlineBusy(true);
    try {
      const current = await fetch("/api/appointments/settings");
      if (!current.ok) return;
      const currentJson = await current.json();
      const existing = currentJson?.data?.staff || [];
      const member = { ...newStaffMember(), name };
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff: [...existing, member] }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      const savedStaff = (saved?.data?.staff || []) as Array<{
        id: string;
        name: string;
        role?: string;
        active?: boolean;
      }>;
      setStaffOptions(
        savedStaff
          .filter((s) => s.active !== false)
          .map((s) => ({ id: s.id, name: s.name, role: s.role })),
      );
      const created = savedStaff.find((s) => s.name === name);
      if (created) {
        update("staffAssignment", "specific_staff");
        update("staffIds", [...form.staffIds, created.id]);
      }
      setInlineName("");
      setAddingStaff(false);
    } finally {
      setInlineBusy(false);
    }
  }

  async function addLocationInline() {
    const name = inlineName.trim();
    if (!name) return;
    setInlineBusy(true);
    try {
      const current = await fetch("/api/appointments/settings");
      if (!current.ok) return;
      const currentJson = await current.json();
      const existing = currentJson?.data?.locations || [];
      const location = { ...newLocation(), name };
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: [...existing, location] }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      const savedLocations = (saved?.data?.locations || []) as Array<{
        id: string;
        name: string;
        kind?: string;
        address?: string;
        active?: boolean;
      }>;
      setLocationOptions(
        savedLocations
          .filter((l) => l.active !== false)
          .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
      );
      const created = savedLocations.find((l) => l.name === name);
      if (created) update("locationIds", [...form.locationIds, created.id]);
      setInlineName("");
      setAddingLocation(false);
    } finally {
      setInlineBusy(false);
    }
  }

  function goNext() {
    if (stepError) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const createService = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Service name is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = buildSavePayload({ ...form, bookingTypeKind: "SERVICE", enabled: true });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not create service");
      setSaving(false);
      return;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    router.replace(`${routes.detail(saved.id)}?created=1`);
  }, [form, router]);

  function setPrice(cents: number, mode: AppointmentTypeFormState["paymentMode"]) {
    update("paymentPriceCents", cents);
    update("paymentMode", mode);
    if (mode === "none") {
      update("showPriceOnBooking", cents > 0);
      update("priceDisplay", cents > 0 ? `$${(cents / 100).toFixed(2)}` : "");
    } else {
      update("showPriceOnBooking", false);
      update("priceDisplay", "");
      if (!form.paymentProvider && providers[0]) update("paymentProvider", providers[0].provider);
    }
  }

  if (loading) {
    return (
      <ArOpusPage className="animate-pulse p-6">
        <div className="h-96 max-w-3xl rounded-xl bg-muted" />
      </ArOpusPage>
    );
  }

  const visibleError = showValidation ? stepError : null;
  const isFree = form.paymentPriceCents <= 0;

  const stepEditor = (
    <div className={cn(OPUS_CARD, "p-5 md:p-6")}>
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="ws-section-heading">What are customers booking?</p>
                  <p className="ws-section-sub">
                    Everything else can be adjusted after the service exists.
                  </p>
                </div>
                <Field label="Service name" htmlFor="wiz-name">
                  <TextInput
                    id="wiz-name"
                    autoFocus
                    placeholder="60 Minute Consultation"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field
                  label="Category"
                  htmlFor="wiz-category"
                  hint="Groups this service on your booking page."
                >
                  <SelectInput
                    id="wiz-category"
                    value={form.categoryId}
                    onChange={(e) => update("categoryId", e.target.value)}
                  >
                    <option value="">No category</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Description" htmlFor="wiz-description" hint="Optional.">
                  <TextArea
                    id="wiz-description"
                    rows={3}
                    placeholder="Describe what customers receive."
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
                <div className="mt-4 max-w-md">
                  <OpusCoverImageUploader
                    value={form.imageUrl}
                    onChange={(url) => update("imageUrl", url)}
                    category="service"
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Time &amp; place</p>
                  <p className="ws-section-sub">
                    Buffers, phases and equipment come later — this is the minimum to be bookable.
                  </p>
                </div>

                <div className="max-w-[14rem]">
                  <Field label="Duration" htmlFor="wiz-duration">
                    <NumberField
                      id="wiz-duration"
                      suffix="min"
                      min={5}
                      step={5}
                      value={form.durationMinutes}
                      onChange={(e) => update("durationMinutes", Number(e.target.value) || 5)}
                    />
                  </Field>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                      Who provides it
                    </p>
                    {staffOptions.length > 0 ? (
                      <button
                        type="button"
                        className="ws-text-btn"
                        onClick={() => {
                          setInlineName("");
                          setAddingStaff((v) => !v);
                          setAddingLocation(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add staff
                      </button>
                    ) : null}
                  </div>
                  {staffOptions.length === 0 ? (
                    <div className="ws-nudge mt-2">
                      <span className="ws-nudge-icon" aria-hidden>
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                          No staff yet
                        </p>
                        <p className="ws-field-hint">
                          Add your first provider here — you will not lose this draft.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <TextInput
                            aria-label="New staff name"
                            placeholder="Jordan Blake"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="appt-pilot-primary-btn shrink-0"
                            disabled={!inlineName.trim() || inlineBusy}
                            onClick={() => void addStaffInline()}
                          >
                            {inlineBusy ? "Adding…" : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="ws-field-hint">
                        Leave everyone unselected to let any available provider take it.
                      </p>
                      <ul className="ws-person-grid mt-2">
                        {staffOptions.map((s) => {
                          const on = form.staffIds.includes(s.id);
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                className="ws-person-card"
                                aria-pressed={on}
                                onClick={() => {
                                  const next = on
                                    ? form.staffIds.filter((x) => x !== s.id)
                                    : [...form.staffIds, s.id];
                                  update("staffIds", next);
                                  update(
                                    "staffAssignment",
                                    next.length ? "specific_staff" : "any_eligible",
                                  );
                                }}
                              >
                                <span className="ws-person-avatar" aria-hidden>
                                  {initials(s.name)}
                                </span>
                                <span className="min-w-0 flex-1 text-left">
                                  <span className="ws-person-name block truncate">{s.name}</span>
                                  <span className="ws-person-meta block truncate">
                                    {s.role || "Provider"}
                                  </span>
                                </span>
                                {on ? (
                                  <span className="ws-person-check" aria-hidden>
                                    <Check className="h-3 w-3" />
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {addingStaff ? (
                        <div className="mt-3 flex gap-2">
                          <TextInput
                            aria-label="New staff name"
                            placeholder="Jordan Blake"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="appt-pilot-primary-btn shrink-0"
                            disabled={!inlineName.trim() || inlineBusy}
                            onClick={() => void addStaffInline()}
                          >
                            {inlineBusy ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
                      Where it happens
                    </p>
                    {locationOptions.length > 0 ? (
                      <button
                        type="button"
                        className="ws-text-btn"
                        onClick={() => {
                          setInlineName("");
                          setAddingLocation((v) => !v);
                          setAddingStaff(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add location
                      </button>
                    ) : null}
                  </div>
                  {locationOptions.length === 0 ? (
                    <div className="ws-nudge mt-2">
                      <span className="ws-nudge-icon" aria-hidden>
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                          No locations yet
                        </p>
                        <p className="ws-field-hint">
                          Add where this happens, or skip and set it later.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <TextInput
                            aria-label="New location name"
                            placeholder="Downtown studio"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="appt-pilot-primary-btn shrink-0"
                            disabled={!inlineName.trim() || inlineBusy}
                            onClick={() => void addLocationInline()}
                          >
                            {inlineBusy ? "Adding…" : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ul className="ws-person-grid mt-2">
                        {locationOptions.map((l) => {
                          const Icon = LOCATION_ICONS[l.kind || "custom"] || MapPin;
                          const on = form.locationIds.includes(l.id);
                          return (
                            <li key={l.id}>
                              <button
                                type="button"
                                className="ws-person-card"
                                aria-pressed={on}
                                onClick={() =>
                                  update(
                                    "locationIds",
                                    on
                                      ? form.locationIds.filter((x) => x !== l.id)
                                      : [...form.locationIds, l.id],
                                  )
                                }
                              >
                                <span className="ws-place-icon" aria-hidden>
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1 text-left">
                                  <span className="ws-person-name block truncate">{l.name}</span>
                                  <span className="ws-person-meta block truncate">
                                    {l.address || "Location"}
                                  </span>
                                </span>
                                {on ? (
                                  <span className="ws-person-check" aria-hidden>
                                    <Check className="h-3 w-3" />
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {addingLocation ? (
                        <div className="mt-3 flex gap-2">
                          <TextInput
                            aria-label="New location name"
                            placeholder="Downtown studio"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="appt-pilot-primary-btn shrink-0"
                            disabled={!inlineName.trim() || inlineBusy}
                            onClick={() => void addLocationInline()}
                          >
                            {inlineBusy ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Price</p>
                  <p className="ws-section-sub">
                    Deposits, packages and price rules can be added afterwards.
                  </p>
                </div>

                <div className="ws-choice-grid">
                  <ChoiceCard
                    selected={isFree}
                    icon={Gift}
                    name="Free"
                    helper="No charge shown and nothing collected."
                    onSelect={() => setPrice(0, "none")}
                  />
                  <ChoiceCard
                    selected={!isFree}
                    icon={BadgeDollarSign}
                    name="Paid"
                    helper="One price for every booking."
                    onSelect={() => setPrice(form.paymentPriceCents || 10000, form.paymentMode)}
                  />
                </div>

                {!isFree ? (
                  <div className="space-y-4">
                    <div className="max-w-[14rem]">
                      <Field label="Price" htmlFor="wiz-price">
                        <div className="ws-money-field">
                          <span aria-hidden>$</span>
                          <input
                            id="wiz-price"
                            className="input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={(form.paymentPriceCents / 100).toFixed(2)}
                            onChange={(e) =>
                              setPrice(
                                Math.round((Number(e.target.value) || 0) * 100),
                                form.paymentMode,
                              )
                            }
                          />
                        </div>
                      </Field>
                    </div>

                    <div className="ws-choice-grid">
                      <ChoiceCard
                        selected={form.paymentMode === "none"}
                        icon={Wallet}
                        name="Pay in person"
                        helper="The price is shown but nothing is charged online."
                        onSelect={() => setPrice(form.paymentPriceCents, "none")}
                      />
                      <ChoiceCard
                        selected={form.paymentMode === "full"}
                        icon={CreditCard}
                        name="Pay when booking"
                        helper="The full amount is charged at checkout."
                        onSelect={() => setPrice(form.paymentPriceCents, "full")}
                      />
                    </div>

                    {form.paymentMode !== "none" ? (
                      providers.length === 0 ? (
                        <div className="ws-nudge">
                          <span className="ws-nudge-icon" aria-hidden>
                            <CreditCard className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                              No payment provider connected
                            </p>
                            <p className="ws-field-hint">
                              Choose &ldquo;Pay in person&rdquo; for now, or connect Stripe or Square
                              in{" "}
                              <Link href="/settings/business" className="appt-pilot-muted-link">
                                business settings
                              </Link>
                              .
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-[16rem]">
                          <Field label="Provider" htmlFor="wiz-provider">
                            <SelectInput
                              id="wiz-provider"
                              value={form.paymentProvider}
                              onChange={(e) =>
                                update("paymentProvider", e.target.value as "stripe" | "square")
                              }
                            >
                              <option value="">Select provider</option>
                              {providers.map((p) => (
                                <option key={p.provider} value={p.provider}>
                                  {p.label}
                                </option>
                              ))}
                            </SelectInput>
                          </Field>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="ws-section-heading">Ready to create</p>
                <p className="ws-section-sub">
                  You can change any of this afterwards in the service editor.
                </p>
                <dl className="mt-4 text-[var(--type-list)]">
                  {(
                    [
                      [Briefcase, "Service", form.name.trim() || "Untitled service"],
                      [Tag, "Category", categoryName || "None"],
                      [Clock, "Duration", formatDurationMinutes(form.durationMinutes)],
                      [
                        UserRound,
                        "Staff",
                        form.staffIds.length
                          ? form.staffIds
                              .map((id) => staffNames.get(id))
                              .filter(Boolean)
                              .join(", ")
                          : "Any available",
                      ],
                      [
                        MapPin,
                        "Location",
                        form.locationIds.length
                          ? form.locationIds
                              .map((id) => locationNames.get(id))
                              .filter(Boolean)
                              .join(", ")
                          : "Not set",
                      ],
                      [Wallet, "Price", priceSummary(form)],
                    ] as Array<[React.ComponentType<{ className?: string }>, string, string]>
                  ).map(([Icon, k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                    >
                      <dt className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {k}
                      </dt>
                      <dd className="truncate font-semibold text-[var(--text-primary)]" title={v}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

      {visibleError || error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error || visibleError}
        </p>
      ) : null}
    </div>
  );

  return (
    <SchedulingWizardShell
      backHref={routes.list}
      backLabel="Services"
      title="Create service"
      description="Set up a bookable service customers can schedule online."
      steps={STEPS}
      currentStep={step}
      onStepSelect={(i) => {
        setShowValidation(false);
        setStep(i);
      }}
      editor={stepEditor}
      preview={
        <ServiceLivePreview
          form={form}
          staffNames={staffNames}
          locationNames={locationNames}
          categoryName={categoryName}
        />
      }
      footerLeft={
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || saving}
          onClick={() => {
            setShowValidation(false);
            setStep((s) => Math.max(0, s - 1));
          }}
        >
          <ArrowLeft className="mr-2 size-4" aria-hidden />
          Back
        </Button>
      }
      footerRight={
        step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Continue
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" disabled={saving} onClick={() => void createService()}>
            <Check className="mr-2 size-4" aria-hidden />
            {saving ? "Creating…" : "Create service"}
          </Button>
        )
      }
      showPreviewOnMobile
    />
  );
}
