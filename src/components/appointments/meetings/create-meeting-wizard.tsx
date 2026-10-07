"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileText,
  Link2,
  MapPin,
  Phone,
  Plus,
  Presentation,
  UserPlus,
  Video,
} from "lucide-react";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import { newStaffMember } from "@/features/appointments/kimi/shared/platform-settings-types";
import {
  isValidMeetingLink,
  MEETING_METHODS,
  methodDef,
  type MeetingMethodDef,
} from "@/lib/appointments/meetings/meeting-methods";
import {
  availabilityScheduleLabel,
  formatDurationMinutes,
  meetingMethodLabel,
} from "@/lib/appointments/meetings/meeting-display";
import { ChoiceCard, Field, NumberField, SelectInput, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from "@/lib/appointments/bookable-workspace-routes";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot ref-root";

const STEPS = [
  { label: "Basics", icon: FileText },
  { label: "How you'll meet", icon: Video },
  { label: "Availability", icon: CalendarClock },
  { label: "Review", icon: ClipboardCheck },
] as const;

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Transovo Video": Video,
  "Google Meet": Video,
  "Microsoft Teams": Presentation,
  Zoom: Video,
  Webex: Video,
  "Custom meeting link": Link2,
  "In person": MapPin,
  "Phone call": Phone,
};

function MeetingSoFar({
  form,
  staffNames,
  scheduleOptions,
}: {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
  scheduleOptions: Array<{ id: string; name: string }>;
}) {
  const hostNames = form.staffIds.map((id) => staffNames.get(id)).filter(Boolean) as string[];
  const rows: Array<[string, string, boolean]> = [
    ["Name", form.name.trim() || "Not set", Boolean(form.name.trim())],
    ["Duration", formatDurationMinutes(form.durationMinutes), form.durationMinutes >= 5],
    [
      "Host",
      hostNames.length ? hostNames.join(", ") : "Any available host",
      true,
    ],
    ["Method", meetingMethodLabel({ location: form.location }), Boolean(form.location)],
    [
      "Availability",
      availabilityScheduleLabel(form.namedScheduleId, scheduleOptions),
      true,
    ],
  ];

  return (
    <aside className="ws-wizard-summary" aria-label="Meeting so far">
      <h4>Meeting so far</h4>
      <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--text-primary)]">
        {form.name.trim() || "Untitled meeting"}
      </p>
      <dl className="mt-3 space-y-2 border-t border-[var(--border-soft)] pt-3 text-[var(--type-helper)]">
        {rows.map(([label, value, set]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">{label}</dt>
            <dd
              className={`truncate font-semibold ${set ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function CreateMeetingWizard({
  routes = APPOINTMENTS_MEETINGS_ROUTES,
}: {
  routes?: MeetingsWorkspaceRoutes;
} = {}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [scheduleOptions, setScheduleOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [newHost, setNewHost] = useState("");
  const [addingHost, setAddingHost] = useState(false);

  useEffect(() => {
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

    void fetch("/api/appointments/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const platform = json?.data || {};
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        );
        setScheduleOptions(
          (platform.namedSchedules || []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
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

  const selectedMethod = methodDef(form.location);

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!form.name.trim()) return "Give this meeting a name.";
      if (form.durationMinutes < 5) return "Duration must be at least 5 minutes.";
      return null;
    }
    if (step === 1) {
      if (!form.location) return "Choose how you will meet.";
      if (selectedMethod?.kind === "link" && !isValidMeetingLink(form.meetingLink)) {
        return "Add the join link for this method.";
      }
      return null;
    }
    return null;
  }, [form, selectedMethod, step]);

  async function addHost() {
    const name = newHost.trim();
    if (!name) return;
    setAddingHost(true);
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
        active?: boolean;
      }>;
      setStaffOptions(
        savedStaff.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
      );
      const created = savedStaff.find((s) => s.name === name);
      if (created) update("staffIds", [...form.staffIds, created.id]);
      setNewHost("");
    } finally {
      setAddingHost(false);
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

  const createMeeting = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Meeting name is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = buildSavePayload({ ...form, bookingTypeKind: "MEETING", enabled: true });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not create meeting");
      setSaving(false);
      return;
    }
    const json = await res.json();
    const saved = json.data as ApiAppointmentType;
    router.replace(`${routes.detail(saved.id)}?created=1`);
  }, [form, router]);

  function selectMethod(def: MeetingMethodDef) {
    update("location", def.value);
    update("transovoVideoEnabled", def.kind === "native");
    if (def.kind !== "link") update("meetingLink", "");
    setShowValidation(false);
  }

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
        <Link href={routes.list} className="appt-pilot-back-link">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Meetings
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <span className="ws-object-icon" aria-hidden>
            <Video className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
              Create meeting
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
                <div className={`ws-wizard-step ${state}`} aria-current={i === step ? "step" : undefined}>
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
                <Field label="Meeting name" htmlFor="wiz-name">
                  <TextInput
                    id="wiz-name"
                    value={form.name}
                    placeholder="Discovery call"
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field label="Duration" htmlFor="wiz-duration">
                  <NumberField
                    id="wiz-duration"
                    suffix="min"
                    min={5}
                    step={5}
                    value={form.durationMinutes}
                    onChange={(e) => update("durationMinutes", Number(e.target.value) || 30)}
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="wiz-desc"
                  hint="Optional. Shown under the meeting name when customers book."
                >
                  <TextArea
                    id="wiz-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <p className="ws-section-heading">Meeting method</p>
                  <p className="ws-section-sub">How you and the customer connect.</p>
                  <div className="ws-choice-grid mt-3">
                    {MEETING_METHODS.map((def) => (
                      <ChoiceCard
                        key={def.value}
                        selected={form.location === def.value}
                        icon={METHOD_ICONS[def.value] || Video}
                        name={def.label}
                        helper={def.helper}
                        onSelect={() => selectMethod(def)}
                      />
                    ))}
                  </div>
                  {selectedMethod?.kind === "link" ? (
                    <div className="ws-choice-config">
                      <p className="ws-choice-config-title">
                        <Link2 className="h-3 w-3" aria-hidden />
                        {selectedMethod.label} join link
                      </p>
                      <div className="mt-2.5">
                        <Field label="Meeting URL" htmlFor="wiz-link">
                          <TextInput
                            id="wiz-link"
                            type="url"
                            placeholder="https://us02web.zoom.us/j/0000000000"
                            value={form.meetingLink}
                            onChange={(e) => update("meetingLink", e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-[var(--border-soft)] pt-5">
                  <p className="ws-section-heading">Host</p>
                  <p className="ws-section-sub">Who takes the meeting.</p>
                  {staffOptions.length === 0 ? (
                    <div className="ws-nudge mt-3">
                      <span className="ws-nudge-icon" aria-hidden>
                        <UserPlus className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                          No bookable hosts yet
                        </p>
                        <p className="ws-field-hint">
                          Add your first host without leaving this page.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <TextInput
                            id="wiz-host-add"
                            aria-label="New host name"
                            placeholder="Host name"
                            value={newHost}
                            onChange={(e) => setNewHost(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void addHost();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="appt-pilot-primary-btn shrink-0"
                            disabled={!newHost.trim() || addingHost}
                            onClick={() => void addHost()}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            {addingHost ? "Adding…" : "Add host"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Field
                        label="Assign to"
                        htmlFor="wiz-host"
                        hint="You can switch to round robin or collective hosting after creating."
                      >
                        <SelectInput
                          id="wiz-host"
                          value={form.staffIds[0] || ""}
                          onChange={(e) =>
                            update("staffIds", e.target.value ? [e.target.value] : [])
                          }
                        >
                          <option value="">Any available host</option>
                          {staffOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <Field
                  label="Availability schedule"
                  htmlFor="wiz-schedule"
                  hint="Slots are the overlap of this schedule and each host's calendar."
                >
                  <SelectInput
                    id="wiz-schedule"
                    value={form.namedScheduleId}
                    onChange={(e) => update("namedScheduleId", e.target.value)}
                  >
                    <option value="">Workspace default hours</option>
                    {scheduleOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Minimum notice" htmlFor="wiz-notice">
                    <NumberField
                      id="wiz-notice"
                      suffix="min"
                      min={0}
                      step={15}
                      value={form.minimumBookingNoticeMinutes}
                      onChange={(e) =>
                        update("minimumBookingNoticeMinutes", Number(e.target.value) || 0)
                      }
                    />
                  </Field>
                  <Field label="Book up to" htmlFor="wiz-ahead">
                    <NumberField
                      id="wiz-ahead"
                      suffix="days"
                      min={1}
                      value={form.maximumBookingDaysAhead}
                      onChange={(e) =>
                        update("maximumBookingDaysAhead", Number(e.target.value) || 14)
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="ws-section-heading">Ready to create</p>
                <p className="ws-section-sub">
                  You can change any of this afterwards in the meeting editor.
                </p>
                <dl className="mt-4 text-[var(--type-list)]">
                  {[
                    ["Meeting", form.name.trim() || "Untitled meeting"],
                    ["Duration", formatDurationMinutes(form.durationMinutes)],
                    [
                      "Host",
                      form.staffIds[0]
                        ? staffNames.get(form.staffIds[0]) || "Selected host"
                        : "Any available host",
                    ],
                    ["Method", meetingMethodLabel({ location: form.location })],
                    [
                      "Availability",
                      availabilityScheduleLabel(form.namedScheduleId, scheduleOptions),
                    ],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                    >
                      <dt className="text-[var(--text-secondary)]">{k}</dt>
                      <dd className="truncate font-semibold text-[var(--text-primary)]" title={v}>
                        {v}
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

          <MeetingSoFar form={form} staffNames={staffNames} scheduleOptions={scheduleOptions} />
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
              disabled={saving}
              onClick={() => void createMeeting()}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {saving ? "Creating…" : "Create meeting"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
