"use client";

import { createId } from "@/lib/supabase/id";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Patch = (partial: Partial<AppointmentReceptionistWizardState>) => void;

const EVENT_ROWS: Array<{ key: string; label: string }> = [
  { key: "callback.requested", label: "Messages & callback requests" },
  { key: "emergency", label: "Emergency calls" },
  { key: "transfer.failed", label: "Failed emergency transfers" },
  { key: "transfer.connected", label: "Successful emergency transfers" },
  { key: "appointment.booked", label: "Appointment bookings" },
  { key: "appointment.changed", label: "Appointment changes" },
  { key: "call.completed", label: "Every completed call" },
];

export function AfterHoursNotificationsEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: Patch;
}) {
  const events = state.afterHoursNotificationEvents ?? {};
  const recipients = state.afterHoursNotificationRecipients ?? [];

  const setEventChannel = (key: string, channel: "sms" | "email", on: boolean) => {
    const row = events[key] ?? {};
    patch({
      afterHoursNotificationEvents: {
        ...events,
        [key]: { ...row, [channel]: on },
      },
    });
  };

  const updateRecipient = (
    id: string,
    partial: Partial<NonNullable<AppointmentReceptionistWizardState["afterHoursNotificationRecipients"]>[number]>,
  ) => {
    patch({
      afterHoursNotificationRecipients: recipients.map((r) =>
        r.id === id ? { ...r, ...partial } : r,
      ),
    });
  };

  const addRecipient = () => {
    patch({
      afterHoursNotificationRecipients: [
        ...recipients,
        {
          id: createId(),
          label: "Team member",
          smsE164: "",
          email: "",
          smsEnabled: true,
          emailEnabled: true,
          enabled: true,
        },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Send notifications for</h4>
        <ul className="mt-2 space-y-2">
          {EVENT_ROWS.map((row) => {
            const flags = events[row.key] ?? {};
            const defaultOn =
              row.key === "callback.requested" ||
              row.key === "emergency" ||
              row.key === "transfer.failed";
            const sms = flags.sms ?? defaultOn;
            const email = flags.email ?? defaultOn;
            return (
              <li key={row.key} className="rounded-lg border border-border px-3 py-2">
                <p className="text-sm font-medium">{row.label}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sms}
                      onChange={(e) => setEventChannel(row.key, "sms", e.target.checked)}
                    />
                    SMS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={email}
                      onChange={(e) => setEventChannel(row.key, "email", e.target.checked)}
                    />
                    Email
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Notify</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          After-hours alerts go to these destinations. SMS uses your workspace sending number.
        </p>
        <div className="mt-3 space-y-3">
          {recipients.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Label>Label</Label>
                  <Input
                    value={r.label}
                    onChange={(e) => updateRecipient(r.id, { label: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <input
                    type="checkbox"
                    checked={r.enabled !== false}
                    onChange={(e) => updateRecipient(r.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>SMS (E.164)</Label>
                  <Input
                    value={r.smsE164 ?? ""}
                    onChange={(e) => updateRecipient(r.id, { smsE164: e.target.value })}
                    placeholder="+15715551212"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={r.email ?? ""}
                    onChange={(e) => updateRecipient(r.id, { email: e.target.value })}
                    placeholder="team@example.com"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
            + Add recipient
          </Button>
        </div>
      </div>
    </div>
  );
}
