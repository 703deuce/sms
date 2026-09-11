"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  Globe,
  MapPin,
  Plus,
  Presentation,
  Tag,
  Ticket,
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
  EMPTY_WORKSHOP_FORM,
  workshopSavePayload,
  type WorkshopFormState,
  type WorkshopSeriesRow,
} from "@/lib/appointments/workshops/workshop-form";
import {
  durationLabel,
  formatSessionFull,
  sessionDraftToRange,
  todayISODate,
} from "@/lib/appointments/workshops/workshop-schedule";
import { workshopPriceLabel } from "@/lib/appointments/workshops/workshop-summary";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS = "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";
const API = "/api/appointments/service-booking/workshops";

const STEPS = [
  { label: "Basics", icon: Presentation },
  { label: "Date & place", icon: CalendarDays },
  { label: "Registration", icon: Ticket },
  { label: "Review", icon: ClipboardCheck },
] as const;

const LENGTH_PRESETS = [60, 90, 120, 180, 240, 480];

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

function WorkshopSoFar({
  form,
  staffNames,
  locationNames,
}: {
  form: WorkshopFormState;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
}) {
  const range = sessionDraftToRange(form.schedule);
  const place =
    form.locationMode === "virtual"
      ? form.virtualUrl.trim()
        ? "Online"
        : "Online — no link yet"
      : form.locationMode === "custom"
        ? form.locationNote.trim() || "Custom venue"
        : locationNames.get(form.locationId) || "Not set";

  const rows: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    set: boolean;
  }> = [
    { icon: Tag, label: "Category", value: form.category || "None", set: Boolean(form.category) },
    {
      icon: CalendarDays,
      label: "Date",
      value: range ? formatSessionFull(range.startsAt, range.endsAt) : "Not set",
      set: Boolean(range),
    },
    {
      icon: Clock,
      label: "Length",
      value: durationLabel(form.schedule.durationMinutes) || "Not set",
      set: form.schedule.durationMinutes > 0,
    },
    {
      icon: form.locationMode === "virtual" ? Globe : MapPin,
      label: "Place",
      value: place,
      set: place !== "Not set" && place !== "Online — no link yet",
    },
    {
      icon: UserRound,
      label: "Host",
      value: form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Unassigned",
      set: Boolean(form.staffId),
    },
    { icon: Users, label: "Spots", value: `${form.capacity} total`, set: form.capacity > 0 },
    { icon: Wallet, label: "Price", value: workshopPriceLabel(form), set: true },
  ];

  return (
    <aside className="ws-wizard-summary" aria-label="Workshop so far">
      <h4>Workshop so far</h4>
      <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--text-primary)]">
        {form.name.trim() || "Untitled workshop"}
      </p>
      <dl className="mt-3 space-y-2 border-t border-[var(--border-soft)] pt-3 text-[var(--type-helper)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <row.icon className="h-3 w-3" aria-hidden />
              {row.label}
            </dt>
            <dd
              className={`truncate font-semibold ${
                row.set ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
              }`}
              title={row.value}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function CreateWorkshopWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WorkshopFormState>(EMPTY_WORKSHOP_FORM);
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
    setForm((prev) => ({
      ...prev,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule: { ...prev.schedule, date: todayISODate() },
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
    <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setError("");
    },
    [],
  );

  const setSchedule = useCallback(
    <K extends keyof WorkshopFormState["schedule"]>(
      key: K,
      value: WorkshopFormState["schedule"][K],
    ) => {
      setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, [key]: value } }));
      setError("");
    },
    [],
  );

  const staffNames = useMemo(() => new Map(staffOptions.map((s) => [s.id, s.name])), [staffOptions]);
  const locationNames = useMemo(
    () => new Map(locationOptions.map((l) => [l.id, l.name])),
    [locationOptions],
  );
  const range = useMemo(() => sessionDraftToRange(form.schedule), [form.schedule]);

  const stepError = useMemo(() => {
    if (step === 0 && !form.name.trim()) return "Give this workshop a name.";
    if (step === 1 && !form.schedule.date) return "Pick the date the workshop runs.";
    if (step === 1 && !range) return "That date and start time do not make a valid session.";
    if (step === 1 && form.locationMode === "virtual" && form.virtualUrl.trim()) {
      try {
        new URL(form.virtualUrl.trim());
      } catch {
        return "Enter a full joining link, starting with https://";
      }
    }
    if (step === 2 && form.capacity < 1) return "A workshop needs at least one spot.";
    if (step === 3 && !form.isFree && form.priceCents <= 0) {
      return "Set a price above $0, or mark the workshop free.";
    }
    return null;
  }, [form, range, step]);

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
        list
          .filter((s) => s.active !== false)
          .map((s) => ({ id: s.id, name: s.name, role: s.role })),
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
   * The workshop and its session are created together. A workshop with no
   * session has no date, and a workshop with no date cannot be registered for,
   * so the wizard would otherwise hand back something unusable.
   */
  const createWorkshop = useCallback(async () => {
    setSaving(true);
    setError("");
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workshopSavePayload(form)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create workshop");
      setSaving(false);
      return;
    }
    const saved = json.data as WorkshopSeriesRow;
    const session = sessionDraftToRange(form.schedule);
    let createdSession = true;
    if (session) {
      const occRes = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "occurrences",
          seriesId: saved.id,
          occurrences: [{ ...session, capacity: form.capacity }],
        }),
      });
      createdSession = occRes.ok;
    }
    // The workshop exists either way, so the operator is taken to it rather
    // than losing what they entered; Date & time can add the session.
    router.replace(
      `/appointments/workshops/${saved.id}?created=${createdSession ? "1" : "nosession"}`,
    );
  }, [form, router]);

  if (loading) {
    return (
      <div className={`${SHELL_CLASS} min-h-full animate-pulse bg-[var(--surface-muted)] p-6`}>
        <div className="mx-auto h-96 max-w-3xl rounded-xl bg-[var(--surface)]" />
      </div>
    );
  }

  const visibleError = showValidation ? stepError : null;

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="ws-wizard-shell">
        <Link href="/appointments/workshops" className="appt-pilot-back-link">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Workshops
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <span className="ws-object-icon" aria-hidden>
            <Presentation className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
              Create workshop
            </h1>
            <p className="ws-section-sub">
              Step {step + 1} of {STEPS.length} — {STEPS[step].label}
            </p>
          </div>
        </div>

        <ol className="ws-wizard-steps mt-6" aria-label="Progress">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i === step ? "is-active" : i < step ? "is-done" : "";
            return (
              <li key={s.label} className="contents">
                <div
                  className={`ws-wizard-step ${state}`}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span className="ws-wizard-step-dot" aria-hidden>
                    {i < step ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="ws-wizard-step-label hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 ? (
                  <span className={`ws-wizard-connector${i < step ? " is-done" : ""}`} aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="ws-wizard-layout mt-6">
          <div className="ws-wizard-card">
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="ws-section-heading">What are customers registering for?</p>
                  <p className="ws-section-sub">
                    Everything else can be adjusted after the workshop exists.
                  </p>
                </div>
                <Field label="Workshop name" htmlFor="wiz-ws-name">
                  <TextInput
                    id="wiz-ws-name"
                    autoFocus
                    placeholder="Winter Pottery Intensive"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field
                  label="Category"
                  htmlFor="wiz-ws-category"
                  hint="Groups this workshop on your public page."
                >
                  <TextInput
                    id="wiz-ws-category"
                    placeholder="Ceramics"
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                  />
                </Field>
                <Field label="Description" htmlFor="wiz-ws-description" hint="Optional.">
                  <TextArea
                    id="wiz-ws-description"
                    rows={3}
                    placeholder="What happens on the day, and what people should bring."
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">When and where does it happen?</p>
                  <p className="ws-section-sub">
                    A workshop runs on a date rather than a repeating pattern. More days can be
                    added afterwards.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Date" htmlFor="wiz-ws-date">
                    <TextInput
                      id="wiz-ws-date"
                      type="date"
                      value={form.schedule.date}
                      onChange={(e) => setSchedule("date", e.target.value)}
                    />
                  </Field>
                  <Field label="Start time" htmlFor="wiz-ws-time">
                    <TextInput
                      id="wiz-ws-time"
                      type="time"
                      value={form.schedule.startTime}
                      onChange={(e) => setSchedule("startTime", e.target.value)}
                    />
                  </Field>
                  <Field label="Length" htmlFor="wiz-ws-length">
                    <SelectInput
                      id="wiz-ws-length"
                      value={String(form.schedule.durationMinutes)}
                      onChange={(e) => setSchedule("durationMinutes", Number(e.target.value) || 180)}
                    >
                      {(LENGTH_PRESETS.includes(form.schedule.durationMinutes)
                        ? LENGTH_PRESETS
                        : [...LENGTH_PRESETS, form.schedule.durationMinutes].sort((a, b) => a - b)
                      ).map((m) => (
                        <option key={m} value={m}>
                          {durationLabel(m)}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>

                {range ? (
                  <p className="ws-gap-note">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    <span>Runs {formatSessionFull(range.startsAt, range.endsAt)}.</span>
                  </p>
                ) : null}

                <div>
                  <p className="mb-2 text-[var(--type-label)] font-medium text-[var(--text-primary)]">
                    Where it happens
                  </p>
                  <div className="ws-choice-grid is-triple is-tight">
                    {(
                      [
                        ["in_person", MapPin, "In person", "At one of your locations"],
                        ["virtual", Globe, "Online", "A joining link you send"],
                        ["custom", Ticket, "One-off venue", "A place you type in"],
                      ] as Array<
                        [
                          WorkshopFormState["locationMode"],
                          React.ComponentType<{ className?: string }>,
                          string,
                          string,
                        ]
                      >
                    ).map(([mode, Icon, name, help]) => (
                      <button
                        key={mode}
                        type="button"
                        className="ws-choice-card"
                        aria-pressed={form.locationMode === mode}
                        onClick={() => update("locationMode", mode)}
                      >
                        <span className="ws-choice-icon" aria-hidden>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="ws-choice-name">{name}</span>
                        <span className="ws-choice-help">{help}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.locationMode === "in_person" ? (
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
                              update(
                                "locationId",
                                form.locationId === location.id ? "" : location.id,
                              )
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
                ) : null}

                {form.locationMode === "virtual" ? (
                  <Field
                    label="Joining link"
                    htmlFor="wiz-ws-url"
                    hint="Shown to people who register. You can add it later."
                  >
                    <TextInput
                      id="wiz-ws-url"
                      type="url"
                      placeholder="https://meet.example.com/pottery"
                      value={form.virtualUrl}
                      onChange={(e) => update("virtualUrl", e.target.value)}
                    />
                  </Field>
                ) : null}

                {form.locationMode === "custom" ? (
                  <Field
                    label="Venue"
                    htmlFor="wiz-ws-venue"
                    hint="Shown on the registration page as written."
                  >
                    <TextInput
                      id="wiz-ws-venue"
                      placeholder="Harbour Hall, 14 Quay Street"
                      value={form.locationNote}
                      onChange={(e) => update("locationNote", e.target.value)}
                    />
                  </Field>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[var(--type-label)] font-medium text-[var(--text-primary)]">
                      Host
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
                      No staff yet. Add one above, or assign a host later.
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
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">How many people, and when can they register?</p>
                  <p className="ws-section-sub">
                    Spots are counted across the whole workshop, not per day, and the server
                    enforces them at registration.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Spots"
                    htmlFor="wiz-ws-capacity"
                    hint="For the whole workshop."
                  >
                    <TextInput
                      id="wiz-ws-capacity"
                      type="number"
                      min={1}
                      value={form.capacity}
                      onChange={(e) => update("capacity", Number(e.target.value) || 1)}
                    />
                  </Field>
                  <Field
                    label="Registration opens"
                    htmlFor="wiz-ws-opens"
                    hint="Leave blank to open now."
                  >
                    <TextInput
                      id="wiz-ws-opens"
                      type="datetime-local"
                      value={form.registrationOpensAt}
                      onChange={(e) => update("registrationOpensAt", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Registration closes"
                    htmlFor="wiz-ws-closes"
                    hint="Leave blank to close at the start."
                  >
                    <TextInput
                      id="wiz-ws-closes"
                      type="datetime-local"
                      value={form.registrationClosesAt}
                      onChange={(e) => update("registrationClosesAt", e.target.value)}
                    />
                  </Field>
                </div>

                <Switch
                  checked={form.waitlistEnabled}
                  onChange={(v) => update("waitlistEnabled", v)}
                  label="Take a waitlist when full"
                  description="People can still register interest once every spot is gone."
                />
                <Switch
                  checked={form.showRemainingSpots}
                  onChange={(v) => update("showRemainingSpots", v)}
                  label="Show spots left on the registration page"
                  description="Turn off if a low number would put people off."
                />
                <Switch
                  checked={form.visibility === "public"}
                  onChange={(v) => update("visibility", v ? "public" : "hidden")}
                  label="List on the public page"
                  description="Hidden workshops can still be registered for with a direct link."
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Price &amp; review</p>
                  <p className="ws-section-sub">
                    Check this reads the way a customer will see it before creating the workshop.
                  </p>
                </div>

                <Switch
                  checked={form.isFree}
                  onChange={(v) => update("isFree", v)}
                  label="Free workshop"
                  description="Customers register with no charge."
                />
                {!form.isFree ? (
                  <>
                    <Field label="Price" htmlFor="wiz-ws-price">
                      <div className="ws-money-field max-w-[12rem]">
                        <span aria-hidden>$</span>
                        <input
                          id="wiz-ws-price"
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
                    <p className="ws-gap-note">
                      <Wallet className="h-3.5 w-3.5" aria-hidden />
                      <span>
                        Registrations are taken without a card. The price is what you collect on
                        arrival, and it is marked unpaid until you say otherwise.
                      </span>
                    </p>
                  </>
                ) : null}

                <dl className="text-[var(--type-list)]">
                  {(
                    [
                      [Presentation, "Workshop", form.name.trim() || "Untitled workshop"],
                      [
                        CalendarDays,
                        "Date",
                        range ? formatSessionFull(range.startsAt, range.endsAt) : "Not set",
                      ],
                      [Clock, "Length", durationLabel(form.schedule.durationMinutes) || "Not set"],
                      [
                        form.locationMode === "virtual" ? Globe : MapPin,
                        "Place",
                        form.locationMode === "virtual"
                          ? form.virtualUrl.trim() || "Online — link to add"
                          : form.locationMode === "custom"
                            ? form.locationNote.trim() || "Custom venue — to add"
                            : locationNames.get(form.locationId) || "Not set",
                      ],
                      [
                        UserRound,
                        "Host",
                        form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Unassigned",
                      ],
                      [Users, "Spots", `${form.capacity} for the whole workshop`],
                      [
                        Ticket,
                        "Waitlist",
                        form.waitlistEnabled ? "On when full" : "Off — registration just closes",
                      ],
                      [Wallet, "Price", workshopPriceLabel(form)],
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
              <p className="ws-inline-error mt-4" role="alert">
                {error || visibleError}
              </p>
            ) : null}
          </div>

          <WorkshopSoFar form={form} staffNames={staffNames} locationNames={locationNames} />
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            className="appt-pilot-outline-btn"
            disabled={step === 0 || saving}
            onClick={() => {
              setShowValidation(false);
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="appt-pilot-primary-btn" onClick={goNext}>
              Continue
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={saving || Boolean(stepError)}
              onClick={() => void createWorkshop()}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {saving ? "Creating…" : "Create workshop"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
