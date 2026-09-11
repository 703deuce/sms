"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Briefcase, Check, Clock, CreditCard } from "lucide-react";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
} from "@/components/appointments/meetings/meeting-editor-sections";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const STEPS = ["Basics", "Time & place", "Price", "Review"] as const;

const STEP_ICONS = [Briefcase, Clock, CreditCard, Check] as const;

function formatDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes} min`;
}

function ServiceSoFarSummary({ form }: { form: AppointmentTypeFormState }) {
  const staffLabel =
    form.staffIds.length > 0 || form.collectiveStaffIds.length > 0
      ? "Selected"
      : "Not selected";
  const locationLabel = form.locationIds.length > 0 ? "Selected" : "Not selected";
  const priceLabel =
    form.paymentMode === "none"
      ? form.priceDisplay?.trim() || "Free"
      : form.paymentMode === "full"
        ? "Full payment"
        : "Deposit";

  return (
    <div className="ws-wizard-summary">
      <h4>Service so far</h4>
      <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">
        {form.name.trim() || "Untitled"}
      </p>
      <dl className="mt-3 space-y-2 text-[12px]">
        {[
          ["Duration", formatDuration(form.durationMinutes)],
          ["Staff", staffLabel],
          ["Location", locationLabel],
          ["Price", priceLabel],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">{k}</dt>
            <dd className="font-semibold text-[var(--text-primary)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CreateServiceWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const segment = segmentById("services");
    const kindPatch = defaultConfigPatchForKind("SERVICE");
    const segmentPatch = defaultConfigForSegment(segment);
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "SERVICE",
      classPresentation: "recurring_class",
      groupBookingEnabled: false,
      groupCapacity: 1,
      paymentMode: "none",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);

    void fetch("/api/appointments/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const platform = json?.data?.platform || json?.platform || {};
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        );
        setLocationOptions(
          (platform.locations || []).map((l: { id: string; name: string }) => ({
            id: l.id,
            name: l.name,
          })),
        );
        setCategoryOptions(
          (platform.categories || []).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
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

  const canNext = useMemo(() => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.durationMinutes >= 5;
    if (step === 2) return true;
    return true;
  }, [form, step]);

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
    router.replace(`/appointments/services/${saved.id}?created=1`);
  }, [form, router]);

  const StepIcon = STEP_ICONS[step] || Briefcase;

  if (loading) {
    return (
      <div className="appt-overview-pilot bookable-workspace-pilot ref-root min-h-full animate-pulse p-6">
        <div className="mx-auto max-w-3xl h-96 rounded-xl bg-[var(--surface)]" />
      </div>
    );
  }

  return (
    <div className="appt-overview-pilot bookable-workspace-pilot ref-root min-h-full bg-[var(--surface-muted)]">
      <div className="ws-wizard-shell">
        <Link href="/appointments/services" className="appt-pilot-back-link inline-flex items-center gap-1 text-[13px]">
          <ArrowLeft size={14} aria-hidden /> Services
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="ws-object-icon">
            <StepIcon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">Create service</h1>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
        </div>

        <div className="ws-wizard-progress mt-6" aria-label="Wizard progress">
          {STEPS.map((_, i) => (
            <span key={i} className={i <= step ? "done" : ""} />
          ))}
        </div>

        <div className="ws-wizard-layout mt-6">
          <div className="ws-wizard-card">
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <PilotLabel htmlFor="wiz-service-name">Service name</PilotLabel>
                  <PilotInput
                    id="wiz-service-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Deep tissue massage"
                  />
                </div>
                <div>
                  <PilotLabel htmlFor="wiz-service-category">Category</PilotLabel>
                  <PilotSelect
                    id="wiz-service-category"
                    value={form.categoryId}
                    onChange={(e) => update("categoryId", e.target.value)}
                  >
                    <option value="">No category</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </PilotSelect>
                </div>
                <div>
                  <PilotLabel htmlFor="wiz-service-desc">Description (optional)</PilotLabel>
                  <PilotTextarea
                    id="wiz-service-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <PilotLabel htmlFor="wiz-duration">Duration (minutes)</PilotLabel>
                  <PilotInput
                    id="wiz-duration"
                    type="number"
                    min={5}
                    value={form.durationMinutes}
                    onChange={(e) => update("durationMinutes", Number(e.target.value) || 30)}
                  />
                </div>
                <div className="ws-wizard-muted-box">
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">Staff</p>
                  {staffOptions.length === 0 ? (
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      No staff available yet.{" "}
                      <Link href="/appointments/staff" className="appt-pilot-muted-link">Add staff</Link>
                    </p>
                  ) : (
                    <PilotSelect
                      className="mt-2"
                      value={form.staffIds[0] || ""}
                      onChange={(e) => update("staffIds", e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">Any eligible staff</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </PilotSelect>
                  )}
                </div>
                <div className="ws-wizard-muted-box">
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">Location</p>
                  {locationOptions.length === 0 ? (
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      No locations yet.{" "}
                      <Link href="/appointments/locations" className="appt-pilot-muted-link">Add location</Link>
                    </p>
                  ) : (
                    <PilotSelect
                      className="mt-2"
                      value={form.locationIds[0] || ""}
                      onChange={(e) => update("locationIds", e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">No location</option>
                      {locationOptions.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </PilotSelect>
                  )}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Payment</p>
                <div className="ws-payment-grid mt-3">
                  {[
                    { value: "none" as const, label: "Free", description: "No payment required" },
                    { value: "full" as const, label: "Full payment", description: "Collect when booked" },
                    { value: "deposit" as const, label: "Deposit", description: "Partial payment now" },
                  ].map((card) => (
                    <button
                      key={card.value}
                      type="button"
                      className={`ws-payment-card${form.paymentMode === card.value ? " selected" : ""}`}
                      onClick={() => update("paymentMode", card.value)}
                    >
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{card.label}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{card.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <dl className="space-y-3 text-[13px]">
                {[
                  ["Service", form.name],
                  ["Duration", formatDuration(form.durationMinutes)],
                  ["Staff", form.staffIds[0] ? staffOptions.find((s) => s.id === form.staffIds[0])?.name || "Selected" : "Any eligible staff"],
                  ["Location", form.locationIds[0] ? locationOptions.find((l) => l.id === form.locationIds[0])?.name || "Selected" : "Not set"],
                  ["Price", form.paymentMode === "none" ? "Free" : form.paymentMode],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                    <dt className="text-[var(--text-secondary)]">{k}</dt>
                    <dd className="font-semibold text-[var(--text-primary)]">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {error ? (
              <p className="mt-4 text-[13px] text-[var(--state-error)]" role="alert">{error}</p>
            ) : null}
          </div>

          <ServiceSoFarSummary form={form} />
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            className="appt-pilot-outline-btn"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={saving || !canNext}
              onClick={() => void createService()}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {saving ? "Creating…" : "Create service"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
