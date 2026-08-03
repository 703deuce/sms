"use client";

import type {
  AppointmentReceptionistWizardState,
  AppointmentTypeConfig,
  BookingPermission,
} from "@/lib/solutions/appointment-receptionist/types";
import { Input, Label } from "@/components/ui/input";
import { CheckCircle2, MoreHorizontal, Plus, X } from "lucide-react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel, StatusPill } from "../ui";

const CALENDARS = [
  { id: "google", label: "Google Calendar" },
  { id: "calendly", label: "Calendly" },
  { id: "calcom", label: "Cal.com" },
  { id: "outlook", label: "Microsoft Outlook" },
  { id: "acuity", label: "Acuity" },
  { id: "transovo", label: "Transovo Calendar" },
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

  function connectCalendar(id: string) {
    patch({
      calendarProvider: id,
      calendarConnected: true,
      calendarEmail:
        id === "google" ? "calendar@connected.local" : `${id}@connected.local`,
    });
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
              const connected =
                state.calendarConnected && state.calendarProvider === cal.id;
              return (
                <SelectableCard
                  key={cal.id}
                  selected={connected}
                  onClick={() => connectCalendar(cal.id)}
                  title={cal.label}
                  description={connected ? "Connected" : "Connect"}
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
                    <td className="px-4 py-3 font-medium">{row.name}</td>
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
