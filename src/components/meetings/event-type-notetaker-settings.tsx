"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";

type Props = {
  form: AppointmentTypeFormState;
  onChange: <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => void;
};

export function EventTypeNotetakerSettings({ form, onChange }: Props) {
  const location = (form.location || "").toLowerCase();
  const isExternalMeeting =
    location.includes("zoom") ||
    location.includes("meet") ||
    location.includes("teams") ||
    location.includes("webex") ||
    Boolean(form.notetakerEnabled);

  if (!isExternalMeeting) return null;

  return (
    <Card className="mt-4 space-y-3 border-dashed p-4">
      <div>
        <h3 className="text-sm font-semibold">AI Notetaker</h3>
        <p className="text-xs text-muted-foreground">
          Automatically add AI Notetaker when an appointment is booked with a meeting link.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.notetakerEnabled)}
          onChange={(e) => onChange("notetakerEnabled", e.target.checked)}
        />
        Enable AI Notetaker for this event type
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.notetakerAutoJoin)}
          onChange={(e) => onChange("notetakerAutoJoin", e.target.checked)}
          disabled={!form.notetakerEnabled}
        />
        Auto-add when appointment is booked
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notetakerTranscript !== false}
          onChange={(e) => onChange("notetakerTranscript", e.target.checked)}
          disabled={!form.notetakerEnabled}
        />
        Capture transcript
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notetakerSummary !== false}
          onChange={(e) => onChange("notetakerSummary", e.target.checked)}
          disabled={!form.notetakerEnabled}
        />
        Generate AI summary
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notetakerActionItems !== false}
          onChange={(e) => onChange("notetakerActionItems", e.target.checked)}
          disabled={!form.notetakerEnabled}
        />
        Extract action items
      </label>
      <div>
        <Label htmlFor="notetaker-summary-template">Summary style</Label>
        <select
          id="notetaker-summary-template"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={form.notetakerSummaryTemplate || "general"}
          onChange={(e) => onChange("notetakerSummaryTemplate", e.target.value)}
          disabled={!form.notetakerEnabled}
        >
          <option value="general">General</option>
          <option value="sales">Sales</option>
          <option value="consultation">Consultation</option>
          <option value="customer_success">Customer success</option>
          <option value="interview">Interview</option>
          <option value="project_status">Project status</option>
          <option value="one_on_one">1:1</option>
        </select>
      </div>
    </Card>
  );
}
