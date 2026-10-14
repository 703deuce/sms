"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  ClipboardCheck,
  Clock,
  MapPin,
  Plus,
  Repeat,
  Tag,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Field,
  SelectInput,
  Switch,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import {
  classFormFromRow,
  classSavePayload,
  EMPTY_CLASS_FORM,
  type ClassFormState,
  type ClassSeriesRow,
} from "@/lib/appointments/classes/class-form";
import {
  describeClassRecurrence,
  expandClassRecurrence,
  WEEKDAY_LABELS,
  withStartDate,
} from "@/lib/appointments/classes/class-recurrence";
import { classPriceLabel, formatSessionRange } from "@/lib/appointments/classes/class-summary";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import { SchedulingWizardShell } from "@/components/appointments/scheduling-opus/scheduling-wizard-shell";
import { ClassLivePreview } from "@/components/appointments/scheduling-opus/class-live-preview";
import { OpusCoverImageUploader } from "@/components/appointments/scheduling-opus/opus-cover-image-uploader";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { cn } from "@/lib/utils";

const API = "/api/appointments/service-booking/classes";

const STEPS = [
  { id: "basics", label: "Basics", icon: Users },
  { id: "schedule", label: "Schedule", icon: Clock },
  { id: "capacity", label: "People & capacity", icon: UserRound },
  { id: "review", label: "Price & review", icon: ClipboardCheck },
] as const;

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

export function CreateClassWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClassFormState>(EMPTY_CLASS_FORM);
  const [staffOptions, setStaffOptions] = useState<StaffRow[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  useEffect(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setForm((prev) => ({
      ...prev,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence: {
        ...prev.recurrence,
        startDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        weekdays: [today.getDay()],
      },
    }));

    void fetch("/api/appointments/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        const platform = settings?.data || {};
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean; name?: string }) => s.active !== false && s.name)
            .map((s: { id: string; name: string; role?: string }) => ({
              id: s.id,
              name: s.name,
              role: s.role,
            })),
        );
        setLocationOptions(
          (platform.locations || [])
            .filter((l: { active?: boolean; name?: string }) => l.active !== false && l.name)
            .map((l: { id: string; name: string; kind?: string; address?: string }) => ({
              id: l.id,
              name: l.name,
              kind: l.kind,
              address: l.address,
            })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(
    <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setError("");
    },
    [],
  );

  const setRule = useCallback(
    <K extends keyof ClassFormState["recurrence"]>(
      key: K,
      value: ClassFormState["recurrence"][K],
    ) => {
      setForm((prev) => ({ ...prev, recurrence: { ...prev.recurrence, [key]: value } }));
      setError("");
    },
    [],
  );

  const staffNames = useMemo(() => new Map(staffOptions.map((s) => [s.id, s.name])), [staffOptions]);
  const locationNames = useMemo(
    () => new Map(locationOptions.map((l) => [l.id, l.name])),
    [locationOptions],
  );
  const planned = useMemo(() => expandClassRecurrence(form.recurrence), [form.recurrence]);

  const stepError = useMemo(() => {
    if (step === 0 && !form.name.trim()) return "Give this class a name.";
    if (step === 1 && !form.recurrence.startDate) return "Pick the date the class starts.";
    if (step === 1 && planned.length === 0) {
      return "This pattern produces no sessions — check the days and end rule.";
    }
    if (step === 2 && form.capacity < 1) return "A class needs at least one seat.";
    if (step === 3 && !form.isFree && form.priceCents <= 0) {
      return "Set a price above $0, or mark the class free.";
    }
    return null;
  }, [form, planned.length, step]);

  function goNext() {
    if (stepError) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

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
      const list = (saved?.data?.staff || []) as Array<{
        id: string;
        name: string;
        role?: string;
        active?: boolean;
      }>;
      setStaffOptions(
        list.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name, role: s.role })),
      );
      const created = list.find((s) => s.name === name);
      if (created) update("staffId", created.id);
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
      const list = (saved?.data?.locations || []) as Array<{
        id: string;
        name: string;
        kind?: string;
        address?: string;
        active?: boolean;
      }>;
      setLocationOptions(
        list
          .filter((l) => l.active !== false)
          .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
      );
      const created = list.find((l) => l.name === name);
      if (created) update("locationId", created.id);
      setInlineName("");
      setAddingLocation(false);
    } finally {
      setInlineBusy(false);
    }
  }

  /**
   * The class and its sessions are created in one go. A class that exists with
   * no sessions cannot be registered for, so leaving the operator to generate
   * them separately would make the wizard produce something unusable.
   */
  const createClass = useCallback(async () => {
    setSaving(true);
    setError("");
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classSavePayload(form)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create class");
      setSaving(false);
      return;
    }
    const saved = json.data as ClassSeriesRow;
    const sessions = expandClassRecurrence(classFormFromRow(saved).recurrence);
    if (sessions.length > 0) {
      const occRes = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "occurrences",
          seriesId: saved.id,
          occurrences: sessions.map((s) => ({ ...s, capacity: form.capacity })),
        }),
      });
      if (!occRes.ok) {
        // The class exists, so the operator is sent to it rather than losing
        // everything they just entered; Schedule can create the sessions.
        setError("Class created, but its sessions could not be generated. Add them in Schedule.");
      }
    }
    router.replace(`/appointments/classes/${saved.id}`);
  }, [form, router]);

  if (loading) {
    return (
      <ArOpusPage className="animate-pulse p-6">
        <div className="h-96 max-w-3xl rounded-xl bg-muted" />
      </ArOpusPage>
    );
  }

  const visibleError = showValidation ? stepError : null;
  const rule = form.recurrence;

  const stepEditor = (
    <div className={cn(OPUS_CARD, "p-5 md:p-6")}>
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="ws-section-heading">What are customers registering for?</p>
                  <p className="ws-section-sub">
                    Everything else can be adjusted after the class exists.
                  </p>
                </div>
                <Field label="Class name" htmlFor="wiz-cls-name">
                  <TextInput
                    id="wiz-cls-name"
                    autoFocus
                    placeholder="Sunrise Vinyasa"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field
                  label="Category"
                  htmlFor="wiz-cls-category"
                  hint="Groups this class on your public page."
                >
                  <TextInput
                    id="wiz-cls-category"
                    placeholder="Yoga"
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                  />
                </Field>
                <Field label="Description" htmlFor="wiz-cls-description" hint="Optional.">
                  <TextArea
                    id="wiz-cls-description"
                    rows={3}
                    placeholder="What happens in this class, and who it suits."
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
                <div className="mt-4">
                  <OpusCoverImageUploader
                    value={form.imageUrl}
                    onChange={(url) => update("imageUrl", url)}
                    category={form.requireFullSeries ? "course" : "class"}
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">When does it run?</p>
                  <p className="ws-section-sub">
                    Sessions are created with the class, so it is ready to register for.
                  </p>
                </div>

                <div className="ws-pattern-grid">
                  <button
                    type="button"
                    className="ws-pattern-card"
                    aria-pressed={rule.pattern === "one_time"}
                    onClick={() => setRule("pattern", "one_time")}
                  >
                    <span className="ws-pattern-icon" aria-hidden>
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="ws-pattern-name">One-time</span>
                      <span className="ws-pattern-help">A single session on one date.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ws-pattern-card"
                    aria-pressed={rule.pattern === "repeating"}
                    onClick={() => setRule("pattern", "repeating")}
                  >
                    <span className="ws-pattern-icon" aria-hidden>
                      <CalendarRange className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="ws-pattern-name">Repeating</span>
                      <span className="ws-pattern-help">Runs on a cadence for a set number of sessions.</span>
                    </span>
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Start date" htmlFor="wiz-cls-date">
                    <TextInput
                      id="wiz-cls-date"
                      type="date"
                      value={rule.startDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          recurrence: withStartDate(prev.recurrence, e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Start time" htmlFor="wiz-cls-time">
                    <TextInput
                      id="wiz-cls-time"
                      type="time"
                      value={rule.startTime}
                      onChange={(e) => setRule("startTime", e.target.value)}
                    />
                  </Field>
                  <Field label="Duration" htmlFor="wiz-cls-duration" hint="Minutes.">
                    <TextInput
                      id="wiz-cls-duration"
                      type="number"
                      min={5}
                      step={5}
                      value={rule.durationMinutes}
                      onChange={(e) => setRule("durationMinutes", Number(e.target.value) || 60)}
                    />
                  </Field>
                </div>

                {rule.pattern === "repeating" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Repeat" htmlFor="wiz-cls-repeat">
                      <SelectInput
                        id="wiz-cls-repeat"
                        value={rule.repeat}
                        onChange={(e) => setRule("repeat", e.target.value as typeof rule.repeat)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </SelectInput>
                    </Field>
                    <Field label="Number of sessions" htmlFor="wiz-cls-count">
                      <TextInput
                        id="wiz-cls-count"
                        type="number"
                        min={1}
                        max={60}
                        value={rule.endsAfter}
                        onChange={(e) => setRule("endsAfter", Number(e.target.value) || 1)}
                      />
                    </Field>
                    {rule.repeat === "weekly" || rule.repeat === "biweekly" ? (
                      <div className="sm:col-span-2">
                        <Field label="Days" htmlFor="wiz-cls-days">
                          <div className="ws-day-chips" id="wiz-cls-days">
                            {WEEKDAY_LABELS.map((label, index) => (
                              <button
                                key={label}
                                type="button"
                                className="ws-day-chip"
                                aria-pressed={rule.weekdays.includes(index)}
                                onClick={() =>
                                  setRule(
                                    "weekdays",
                                    rule.weekdays.includes(index)
                                      ? rule.weekdays.filter((d) => d !== index)
                                      : [...rule.weekdays, index].sort(),
                                  )
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <p className="ws-gap-note">
                  <Repeat className="h-3.5 w-3.5" aria-hidden />
                  {describeClassRecurrence(rule)} — {planned.length} session
                  {planned.length === 1 ? "" : "s"} will be created.
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Who runs it, where, and for how many?</p>
                  <p className="ws-section-sub">
                    Capacity is enforced by the server every time somebody registers.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[var(--type-label)] font-medium text-[var(--text-primary)]">
                      Instructor
                    </p>
                    <button
                      type="button"
                      className="ws-text-btn"
                      onClick={() => {
                        setInlineName("");
                        setAddingStaff((v) => !v);
                        setAddingLocation(false);
                      }}
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Add staff
                    </button>
                  </div>
                  {addingStaff ? (
                    <div className="mb-2 flex gap-2">
                      <TextInput
                        aria-label="New staff name"
                        placeholder="Maya Chen"
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
                  {staffOptions.length === 0 ? (
                    <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                      No staff yet. Add one above, or assign an instructor later.
                    </p>
                  ) : (
                    <div className="ws-people-grid">
                      {staffOptions.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          className="ws-people-card"
                          aria-pressed={form.staffId === staff.id}
                          onClick={() =>
                            update("staffId", form.staffId === staff.id ? "" : staff.id)
                          }
                        >
                          <span className="ws-people-avatar" aria-hidden>
                            {initials(staff.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="ws-people-name">{staff.name}</span>
                            <span className="ws-people-meta">{staff.role || "Staff"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[var(--type-label)] font-medium text-[var(--text-primary)]">
                      Location
                    </p>
                    <button
                      type="button"
                      className="ws-text-btn"
                      onClick={() => {
                        setInlineName("");
                        setAddingLocation((v) => !v);
                        setAddingStaff(false);
                      }}
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Add location
                    </button>
                  </div>
                  {addingLocation ? (
                    <div className="mb-2 flex gap-2">
                      <TextInput
                        aria-label="New location name"
                        placeholder="Studio B"
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
                  {locationOptions.length === 0 ? (
                    <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                      No locations yet. Add one above, or set it later.
                    </p>
                  ) : (
                    <div className="ws-people-grid">
                      {locationOptions.map((location) => (
                        <button
                          key={location.id}
                          type="button"
                          className="ws-people-card"
                          aria-pressed={form.locationId === location.id}
                          onClick={() =>
                            update("locationId", form.locationId === location.id ? "" : location.id)
                          }
                        >
                          <span className="ws-people-avatar" aria-hidden>
                            <MapPin className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="ws-people-name">{location.name}</span>
                            <span className="ws-people-meta">
                              {location.address || location.kind || "In person"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Seats per session"
                    htmlFor="wiz-cls-capacity"
                    hint="Enforced by the server at registration."
                  >
                    <TextInput
                      id="wiz-cls-capacity"
                      type="number"
                      min={1}
                      value={form.capacity}
                      onChange={(e) => update("capacity", Number(e.target.value) || 1)}
                    />
                  </Field>
                </div>
                <Switch
                  checked={form.waitlistEnabled}
                  onChange={(v) => update("waitlistEnabled", v)}
                  label="Take a waitlist when full"
                  description="People can still register interest once every seat is gone."
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Price &amp; review</p>
                  <p className="ws-section-sub">
                    Check this reads the way a customer will see it before creating the class.
                  </p>
                </div>

                <Switch
                  checked={form.isFree}
                  onChange={(v) => update("isFree", v)}
                  label="Free class"
                  description="Customers register with no charge."
                />
                {!form.isFree ? (
                  <Field label="Price" htmlFor="wiz-cls-price">
                    <div className="ws-money-field max-w-[12rem]">
                      <span aria-hidden>$</span>
                      <input
                        id="wiz-cls-price"
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={(form.priceCents / 100).toFixed(2)}
                        onChange={(e) =>
                          update("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                        }
                      />
                    </div>
                  </Field>
                ) : null}

                <dl className="text-[var(--type-list)]">
                  {(
                    [
                      [Users, "Class", form.name.trim() || "Untitled class"],
                      [Repeat, "Pattern", describeClassRecurrence(rule)],
                      [
                        Clock,
                        "First session",
                        planned[0]
                          ? formatSessionRange(planned[0].startsAt, planned[0].endsAt)
                          : "None",
                      ],
                      [
                        CalendarRange,
                        "Sessions created",
                        `${planned.length} session${planned.length === 1 ? "" : "s"}`,
                      ],
                      [
                        UserRound,
                        "Instructor",
                        form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Unassigned",
                      ],
                      [
                        MapPin,
                        "Location",
                        form.locationId
                          ? locationNames.get(form.locationId) || "Assigned"
                          : "Not set",
                      ],
                      [Users, "Seats", `${form.capacity} per session`],
                      [Wallet, "Price", classPriceLabel(form)],
                    ] as Array<[React.ComponentType<{ className?: string }>, string, string]>
                  ).map(([Icon, label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                    >
                      <dt className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {label}
                      </dt>
                      <dd className="truncate font-semibold text-[var(--text-primary)]" title={value}>
                        {value}
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
      backHref="/appointments/classes"
      backLabel="Classes"
      title="Create class"
      description="Set up a class or course customers can enroll in."
      steps={STEPS}
      currentStep={step}
      onStepSelect={(i) => {
        setShowValidation(false);
        setStep(i);
      }}
      editor={stepEditor}
      preview={
        <ClassLivePreview
          form={form}
          staffNames={staffNames}
          locationNames={locationNames}
          sessionCount={planned.length}
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
          <Button type="button" disabled={saving || Boolean(stepError)} onClick={() => void createClass()}>
            <Check className="mr-2 size-4" aria-hidden />
            {saving ? "Creating…" : "Create class"}
          </Button>
        )
      }
      showPreviewOnMobile
    />
  );
}
