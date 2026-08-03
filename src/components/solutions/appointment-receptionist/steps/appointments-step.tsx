"use client";

import type {
  AppointmentReceptionistWizardState,
  AppointmentTypeConfig,
  BookingPermission,
} from "@/lib/solutions/appointment-receptionist/types";
import { Input, Label } from "@/components/ui/input";
import { CheckCircle2, MoreHorizontal, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel, StatusPill } from "../ui";

const CALENDARS = [
  { id: "google", label: "Google Calendar" },
  { id: "calendly", label: "Calendly" },
  { id: "calcom", label: "Cal.com" },
  { id: "microsoft", label: "Microsoft Outlook" },
  { id: "acuity", label: "Acuity" },
  { id: "internal", label: "Transovo Calendar" },
];

export function AppointmentsStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const selected =
    state.appointmentTypes.find((t) => t.id === state.selectedAppointmentTypeId) ||
    state.appointmentTypes[0];

  function updateSelected(partial: Partial<AppointmentTypeConfig>) {
    if (!selected) return;
    patch({
      appointmentTypes: state.appointmentTypes.map((t) =>
        t.id === selected.id ? { ...t, ...partial } : t,
      ),
    });
  }

  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; provider: string; status: string }>>([]);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/voice/calendars");
        const json = await res.json();
        const rows = (json.data || []) as Array<{ id: string; name: string; provider: string; status: string }>;
        setCalendars(rows);
        const connected = rows.find(
          (r) =>
            ["google", "microsoft", "internal", "calendly"].includes(r.provider) &&
            ["connected", "active", "ok"].includes(String(r.status || "")),
        );
        if (connected) {
          patch({
            calendarConnected: true,
            calendarProvider: connected.provider,
            calendarEmail: connected.name,
          });
        } else if (
          state.calendarConnected ||
          state.calendarEmail?.endsWith("@connected.local")
        ) {
          patch({ calendarConnected: false, calendarEmail: null });
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectCalendar(providerId: string) {
    setBusyProvider(providerId);
    try {
      const provider = providerId === "outlook" ? "microsoft" : providerId;
      const existing = calendars.find((c) => c.provider === provider);
      let connectionId = existing?.id;
      if (!connectionId) {
        const res = await fetch("/api/voice/calendars", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: CALENDARS.find((c) => c.id === providerId)?.label || "Calendar",
            provider,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create calendar");
        connectionId = json.data.id as string;
      }
      if (provider === "google" || provider === "microsoft") {
        window.location.href = `/api/voice/calendars/oauth/${provider}?connectionId=${connectionId}`;
        return;
      }

      // Refresh local list so status reflects what the API actually created.
      const listRes = await fetch("/api/voice/calendars");
      const listJson = await listRes.json().catch(() => ({ data: [] }));
      const rows = (listJson.data || []) as Array<{
        id: string;
        name: string;
        provider: string;
        status: string;
      }>;
      setCalendars(rows);
      const row = rows.find((c) => c.id === connectionId) || rows.find((c) => c.provider === provider);

      if (provider === "internal") {
        const live = row && ["connected", "active", "ok"].includes(row.status);
        patch({
          calendarProvider: provider,
          calendarConnected: Boolean(live),
          calendarEmail: live ? row?.name || "Transovo Calendar" : null,
        });
        return;
      }

      // calendly / acuity / calcom — creating a calendar row is not a live connection
      patch({
        calendarProvider: provider,
        calendarConnected: false,
        calendarEmail: null,
      });
    } catch {
      // leave UI unchanged
    } finally {
      setBusyProvider(null);
    }
  }

  function isProviderConnected(providerId: string) {
    const provider = providerId === "outlook" ? "microsoft" : providerId;
    if (["calendly", "acuity", "calcom"].includes(provider)) {
      // External schedulers need a real integration connection — creating a
      // VoiceCalendarConnection row alone does not count.
      return false;
    }
    const row = calendars.find((c) => c.provider === provider);
    if (row && ["connected", "active", "ok"].includes(row.status)) return true;
    return (
      state.calendarConnected &&
      (state.calendarProvider === providerId || state.calendarProvider === provider)
    );
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            What can callers book?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a calendar to show real-time availability.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {CALENDARS.map((cal) => {
              const connected = isProviderConnected(cal.id);
              const row = calendars.find((c) => c.provider === cal.id);
              return (
                <SelectableCard
                  key={cal.id}
                  selected={connected}
                  onClick={() => void connectCalendar(cal.id)}
                  title={cal.label}
                  description={
                    busyProvider === cal.id
                      ? "Connecting…"
                      : connected
                        ? "Connected"
                        : ["calendly", "acuity", "calcom"].includes(cal.id)
                          ? "Connect via Integrations"
                          : row?.status === "pending_oauth"
                            ? "Finish OAuth"
                            : row?.status === "pending"
                              ? "Pending setup"
                              : "Connect"
                  }
                  className="min-h-[88px]"
                />
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Appointment types</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              onClick={() => {
                const id = `type_${Date.now()}`;
                patch({
                  appointmentTypes: [
                    ...state.appointmentTypes,
                    {
                      id,
                      name: "New appointment",
                      durationMin: 30,
                      calendar: "Primary calendar",
                      status: "needs_rules",
                      enabled: true,
                      description: "",
                      location: "",
                      modality: "in_person",
                      bookingHours: "Mon - Fri, 8:00 AM - 6:00 PM",
                      minNotice: "2 hours",
                      maxDaysAhead: "30 days",
                      requiredFields: ["full_name", "phone"],
                      bookingPermission: "book_directly",
                    },
                  ],
                  selectedAppointmentTypeId: id,
                });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add appointment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Appointment</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Calendar</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {state.appointmentTypes.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-border ${
                      selected?.id === row.id ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                    onClick={() => patch({ selectedAppointmentTypeId: row.id })}
                  >
                    <td className="px-4 py-3 font-medium">
                      <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={() => {
                            patch({
                              appointmentTypes: state.appointmentTypes.map((t) =>
                                t.id === row.id ? { ...t, enabled: !t.enabled } : t,
                              ),
                            });
                          }}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        <span className={!row.enabled ? "text-muted-foreground line-through" : ""}>
                          {row.name}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.durationMin} min</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.calendar}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={row.status === "ready" ? "success" : "warning"}>
                        {row.status === "ready" ? "Ready" : "Needs rules"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Appointment configuration</h3>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
                onClick={() => patch({ selectedAppointmentTypeId: null })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Appointment details
                </p>
                <div>
                  <Label>Appointment name</Label>
                  <Input
                    className="mt-1"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Duration</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                    value={selected.durationMin}
                    onChange={(e) =>
                      updateSelected({ durationMin: Number(e.target.value) })
                    }
                  >
                    {[15, 30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Assigned staff / calendar</Label>
                  <Input
                    className="mt-1"
                    value={selected.calendar}
                    onChange={(e) => updateSelected({ calendar: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Booking settings
                </p>
                <div className="rounded-lg border border-border px-3 py-2 text-sm">
                  Booking hours: {selected.bookingHours || "Mon - Fri, 8:00 AM - 6:00 PM"}
                </div>
                <div>
                  <Label>Minimum notice</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                    value={selected.minNotice || "2 hours"}
                    onChange={(e) => updateSelected({ minNotice: e.target.value })}
                  >
                    {["1 hour", "2 hours", "4 hours", "1 day"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Maximum days ahead</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                    value={selected.maxDaysAhead || "30 days"}
                    onChange={(e) => updateSelected({ maxDaysAhead: e.target.value })}
                  >
                    {["14 days", "30 days", "60 days", "90 days"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required caller information
                </p>
                <div className="space-y-2">
                  {[
                    ["full_name", "Full name"],
                    ["phone", "Phone number"],
                    ["email", "Email"],
                    ["service", "Service requested"],
                    ["address", "Address"],
                  ].map(([id, label]) => {
                    const checked = selected.requiredFields.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? selected.requiredFields.filter((f) => f !== id)
                              : [...selected.requiredFields, id];
                            updateSelected({ requiredFields: next });
                          }}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Booking permissions
                </p>
                <div className="space-y-2">
                  {(
                    [
                      ["book_directly", "Book directly", "Allow callers to book the appointment."],
                      [
                        "suggest_then_confirm",
                        "Suggest times first",
                        "Show options and confirm with the caller.",
                      ],
                      [
                        "send_booking_link",
                        "Send booking link",
                        "Send a link for the caller to book later.",
                      ],
                    ] as Array<[BookingPermission, string, string]>
                  ).map(([id, label, desc]) => (
                    <RadioRow
                      key={id}
                      selected={selected.bookingPermission === id}
                      onClick={() => updateSelected({ bookingPermission: id })}
                      label={label}
                      description={desc}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SidePanel title="Appointment tools">
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Check availability
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Book appointment
          </li>
        </ul>
        <div className="rounded-xl border border-border p-3 text-xs">
          <p className="font-medium">Calendar connection</p>
          <p className="mt-1 text-muted-foreground">
            {state.calendarConnected
              ? state.calendarEmail || "Connected"
              : "No calendar connected yet"}
          </p>
          {state.calendarConnected ? (
            <StatusPill tone="success">Connected</StatusPill>
          ) : (
            <StatusPill tone="warning">Needed</StatusPill>
          )}
        </div>
        <InfoCallout>
          AI calls your calendar in real time to check availability and book appointments
          instantly. You never copy event IDs or API keys.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
