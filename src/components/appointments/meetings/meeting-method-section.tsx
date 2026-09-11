"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Check,
  Link2,
  MapPin,
  Phone,
  Plus,
  Presentation,
  Video,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  isValidMeetingLink,
  MEETING_METHODS,
  methodDef,
  type MeetingMethodDef,
} from "@/lib/appointments/meetings/meeting-methods";
import { newBookingQuestion } from "@/features/appointments/kimi/shared/platform-settings-types";
import { EventTypeVideoSettings } from "@/components/video/event-type-video-settings";
import { EventTypeNotetakerSettings } from "@/components/meetings/event-type-notetaker-settings";
import { ChoiceCard, Field, SectionCard, SelectInput, TextInput } from "./meeting-ui";

type CalendarStatus = "connected" | "needs_reauth" | "pending_oauth" | "missing";

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

function useCalendarConnections() {
  const [statuses, setStatuses] = useState<Record<string, CalendarStatus>>({});

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/integrations/calendars")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const next: Record<string, CalendarStatus> = {};
        for (const row of (json.data || []) as Array<{ provider: string; status: string }>) {
          // A workspace can hold several accounts per provider; connected wins.
          if (next[row.provider] === "connected") continue;
          next[row.provider] = (row.status as CalendarStatus) || "missing";
        }
        setStatuses(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return statuses;
}

/**
 * The chip states what the method needs, or — once this meeting is actually
 * using it — whether that requirement is met. An unselected method has nothing
 * configured yet, so it can only describe the requirement.
 */
function MethodStatus({
  def,
  calendars,
  selected,
  form,
}: {
  def: MeetingMethodDef;
  calendars: Record<string, CalendarStatus>;
  selected: boolean;
  form: AppointmentTypeFormState;
}) {
  if (def.kind === "native") {
    return (
      <span className="ws-chip ws-chip-success">
        <Check className="h-3 w-3" aria-hidden />
        Always on
      </span>
    );
  }
  if (def.kind === "calendar" && def.provider) {
    const status = calendars[def.provider] || "missing";
    if (status === "connected") {
      return (
        <span className="ws-chip ws-chip-success">
          <Check className="h-3 w-3" aria-hidden />
          Connected
        </span>
      );
    }
    return (
      <span className="ws-chip ws-chip-warning">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        {status === "needs_reauth" ? "Reconnect needed" : "Not connected"}
      </span>
    );
  }
  if (def.kind === "link") {
    if (selected && isValidMeetingLink(form.meetingLink)) {
      return (
        <span className="ws-chip ws-chip-success">
          <Check className="h-3 w-3" aria-hidden />
          Link set
        </span>
      );
    }
    return <span className="ws-chip ws-chip-neutral">Needs a link</span>;
  }
  if (def.kind === "in_person") {
    if (selected && form.locationId) {
      return (
        <span className="ws-chip ws-chip-success">
          <Check className="h-3 w-3" aria-hidden />
          Location set
        </span>
      );
    }
    return <span className="ws-chip ws-chip-neutral">Needs a location</span>;
  }
  return <span className="ws-chip ws-chip-neutral">No link needed</span>;
}

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  locationOptions: Array<{ id: string; name: string }>;
  onAddLocation: (name: string) => Promise<string | null>;
};

export function MeetingMethodSection({ form, onFormChange, locationOptions, onAddLocation }: Props) {
  const calendars = useCalendarConnections();
  const selected = methodDef(form.location);
  const [linkTouched, setLinkTouched] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);

  const selectMethod = useCallback(
    (def: MeetingMethodDef) => {
      onFormChange("location", def.value);
      onFormChange("transovoVideoEnabled", def.kind === "native");
      // Only conferencing methods can be joined by a notetaker.
      if (def.kind === "calendar" || def.kind === "link" || def.kind === "native") {
        onFormChange("notetakerEnabled", true);
        onFormChange("notetakerAutoJoin", true);
      } else {
        onFormChange("notetakerEnabled", false);
        onFormChange("notetakerAutoJoin", false);
      }
      if (def.kind !== "link") onFormChange("meetingLink", "");
      if (def.kind !== "in_person") onFormChange("locationId", "");
      setLinkTouched(false);
    },
    [onFormChange],
  );

  const hasPhoneQuestion = useMemo(
    () => form.bookingQuestions.some((q) => q.type === "phone"),
    [form.bookingQuestions],
  );

  const linkError =
    selected?.kind === "link" && linkTouched && form.meetingLink.trim() && !isValidMeetingLink(form.meetingLink)
      ? "Enter a full URL starting with https://"
      : undefined;

  async function handleAddLocation() {
    const name = newLocation.trim();
    if (!name) return;
    setAddingLocation(true);
    const id = await onAddLocation(name);
    setAddingLocation(false);
    if (id) {
      onFormChange("locationId", id);
      setNewLocation("");
    }
  }

  return (
    <SectionCard
      id="meeting-method"
      title="Meeting method"
      description="How you and the customer actually connect."
      icon={Video}
    >
      <div className="ws-choice-grid">
        {MEETING_METHODS.map((def) => (
          <ChoiceCard
            key={def.value}
            selected={form.location === def.value}
            icon={METHOD_ICONS[def.value] || Video}
            name={def.label}
            helper={def.helper}
            status={
              <MethodStatus
                def={def}
                calendars={calendars}
                selected={form.location === def.value}
                form={form}
              />
            }
            onSelect={() => selectMethod(def)}
          />
        ))}
      </div>

      {!selected ? (
        <div className="ws-nudge mt-4">
          <span className="ws-nudge-icon" aria-hidden>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
              No meeting method selected
            </p>
            <p className="ws-field-hint">
              Customers will not know how to join until you pick one.
            </p>
          </div>
        </div>
      ) : null}

      {selected?.kind === "link" ? (
        <div className="ws-choice-config">
          <p className="ws-choice-config-title">
            <Link2 className="h-3 w-3" aria-hidden />
            {selected.label} join link
          </p>
          <div className="mt-2.5">
            <Field
              label="Meeting URL"
              htmlFor="method-link"
              error={linkError}
              hint="Sent to the customer with their confirmation. The same room is used for every booking."
            >
              <TextInput
                id="method-link"
                type="url"
                inputMode="url"
                placeholder="https://us02web.zoom.us/j/0000000000"
                value={form.meetingLink}
                onBlur={() => setLinkTouched(true)}
                onChange={(e) => onFormChange("meetingLink", e.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {selected?.kind === "in_person" ? (
        <div className="ws-choice-config">
          <p className="ws-choice-config-title">
            <MapPin className="h-3 w-3" aria-hidden />
            Where you meet
          </p>
          {locationOptions.length > 0 ? (
            <div className="mt-2.5">
              <Field
                label="Location"
                htmlFor="method-location"
                hint="Shown on the booking page and in the confirmation."
              >
                <SelectInput
                  id="method-location"
                  value={form.locationId}
                  onChange={(e) => onFormChange("locationId", e.target.value)}
                >
                  <option value="">Select a location</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          ) : (
            <div className="mt-2.5">
              <Field
                label="Add your first location"
                htmlFor="method-new-location"
                hint="Saved to your workspace so other booking types can use it too."
              >
                <div className="flex gap-2">
                  <TextInput
                    id="method-new-location"
                    placeholder="Main office"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                  <button
                    type="button"
                    className="appt-pilot-primary-btn shrink-0"
                    disabled={!newLocation.trim() || addingLocation}
                    onClick={() => void handleAddLocation()}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {addingLocation ? "Adding…" : "Add"}
                  </button>
                </div>
              </Field>
            </div>
          )}
        </div>
      ) : null}

      {selected?.kind === "phone" ? (
        <div className="ws-choice-config">
          <p className="ws-choice-config-title">
            <Phone className="h-3 w-3" aria-hidden />
            Phone details
          </p>
          <p className="mt-2 text-[var(--type-helper)] leading-relaxed text-[var(--text-secondary)]">
            You call the customer at the number they give you. Add a phone question so the
            number is always collected.
          </p>
          {hasPhoneQuestion ? (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[var(--type-helper)] font-semibold text-[var(--state-success)]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Phone number is collected at booking
            </p>
          ) : (
            <button
              type="button"
              className="appt-pilot-outline-btn mt-2.5"
              onClick={() =>
                onFormChange("bookingQuestions", [
                  ...form.bookingQuestions,
                  {
                    ...newBookingQuestion(),
                    label: "Phone number",
                    type: "phone",
                    required: true,
                    displayOrder: form.bookingQuestions.length,
                  },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Collect a phone number
            </button>
          )}
        </div>
      ) : null}

      {selected?.kind === "calendar" && selected.provider ? (
        <div className="ws-choice-config">
          <p className="ws-choice-config-title">
            <Building2 className="h-3 w-3" aria-hidden />
            Calendar connection
          </p>
          {calendars[selected.provider] === "connected" ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[var(--type-helper)] font-semibold text-[var(--state-success)]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              A {selected.label} link is created for each booking.
            </p>
          ) : (
            <p className="mt-2 text-[var(--type-helper)] leading-relaxed text-[var(--text-secondary)]">
              No connected {selected.provider === "google" ? "Google" : "Microsoft"} calendar,
              so join links will not be generated automatically.{" "}
              <Link href="/integrations/calendars" className="appt-pilot-muted-link">
                Connect a calendar
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {/*
       * These two panels are shared with the Services and Classes editors, so
       * they keep their own markup. ws-legacy-panel lets the Meetings layer
       * restyle them to match without altering how they render elsewhere.
       */}
      {selected?.kind === "native" ? (
        <div className="ws-legacy-panel mt-4 space-y-4">
          <EventTypeVideoSettings form={form} onChange={onFormChange} />
        </div>
      ) : null}

      {selected && selected.kind !== "in_person" && selected.kind !== "phone" ? (
        <div className="ws-legacy-panel mt-4">
          <EventTypeNotetakerSettings form={form} onChange={onFormChange} />
        </div>
      ) : null}
    </SectionCard>
  );
}