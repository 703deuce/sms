"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Video } from "lucide-react";
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
} from "./meeting-editor-sections";
import {
  availabilityScheduleLabel,
  formatDurationMinutes,
  hostAssignmentLabel,
  meetingMethodLabel,
} from "@/lib/appointments/meetings/meeting-display";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const STEPS = ["Basics", "How you'll meet", "Availability", "Review"] as const;

function MeetingSoFarSummary({
  form,
  staffNames,
}: {
  form: AppointmentTypeFormState;
  staffNames: Map<string, string>;
}) {
  const host = form.staffIds[0]
    ? staffNames.get(form.staffIds[0]) || "Selected host"
    : hostAssignmentLabel(
        {
          staffAssignment: form.staffAssignment,
          staffIds: form.staffIds,
          collectiveStaffIds: form.collectiveStaffIds,
        },
        staffNames,
      );

  return (
    <div className="ws-wizard-summary">
      <h4>Meeting so far</h4>
      <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">
        {form.name.trim() || "Untitled"}
      </p>
      <dl className="mt-3 space-y-2 text-[12px]">
        {[
          ["Duration", formatDurationMinutes(form.durationMinutes)],
          ["Host", host],
          ["Method", meetingMethodLabel({ location: form.location })],
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

export function CreateMeetingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [namedScheduleOptions, setNamedScheduleOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        const platform = json?.data?.platform || json?.platform || {};
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        );
        setNamedScheduleOptions(
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

  const staffNames = useMemo(() => new Map(staffOptions.map((s) => [s.id, s.name])), [staffOptions]);

  const canNext = useMemo(() => {
    if (step === 0) return form.name.trim().length > 0 && form.durationMinutes >= 5;
    if (step === 1) return Boolean(form.location) && staffOptions.length > 0;
    if (step === 2) return true;
    return true;
  }, [form, step, staffOptions.length]);

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
    router.replace(`/appointments/meetings/${saved.id}?created=1`);
  }, [form, router]);

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
        <Link href="/appointments/meetings" className="appt-pilot-back-link inline-flex items-center gap-1 text-[13px]">
          <ArrowLeft size={14} aria-hidden /> Meetings
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="ws-object-icon">
            <Video className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">Create meeting</h1>
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
                  <PilotLabel htmlFor="wiz-name">Meeting name</PilotLabel>
                  <PilotInput
                    id="wiz-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Discovery call"
                  />
                </div>
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
                <div>
                  <PilotLabel htmlFor="wiz-desc">Description (optional)</PilotLabel>
                  <PilotTextarea
                    id="wiz-desc"
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
                  <PilotLabel>Host</PilotLabel>
                  {staffOptions.length === 0 ? (
                    <p className="text-[13px] text-[var(--state-warning)]">
                      Add a host in{" "}
                      <Link href="/appointments/staff" className="appt-pilot-muted-link">Staff</Link> first.
                    </p>
                  ) : (
                    <PilotSelect
                      value={form.staffIds[0] || ""}
                      onChange={(e) => update("staffIds", e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">Any available staff</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </PilotSelect>
                  )}
                </div>
                <div>
                  <PilotLabel>Meeting method</PilotLabel>
                  <PilotSelect
                    value={form.location}
                    onChange={(e) => {
                      update("location", e.target.value);
                      update("transovoVideoEnabled", e.target.value === "Transovo Video");
                    }}
                  >
                    <option value="">Select method</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                    <option value="Transovo Video">Transovo Video</option>
                    <option value="Phone call">Phone</option>
                    <option value="In person">In person</option>
                    <option value="Custom meeting link">Custom</option>
                  </PilotSelect>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div>
                  <PilotLabel>Availability schedule</PilotLabel>
                  <PilotSelect
                    value={form.namedScheduleId}
                    onChange={(e) => update("namedScheduleId", e.target.value)}
                  >
                    <option value="">Workspace default hours</option>
                    {namedScheduleOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </PilotSelect>
                </div>
                <p className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                  Customers will see open slots based on this schedule and your workspace availability rules.
                </p>
              </div>
            ) : null}

            {step === 3 ? (
              <dl className="space-y-3 text-[13px]">
                {[
                  ["Meeting", form.name],
                  ["Duration", formatDurationMinutes(form.durationMinutes)],
                  [
                    "Host",
                    form.staffIds[0]
                      ? staffNames.get(form.staffIds[0]) || "Selected host"
                      : "Any available staff",
                  ],
                  ["Method", meetingMethodLabel({ location: form.location })],
                  [
                    "Availability",
                    availabilityScheduleLabel(form.namedScheduleId, namedScheduleOptions),
                  ],
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

          <MeetingSoFarSummary form={form} staffNames={staffNames} />
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
