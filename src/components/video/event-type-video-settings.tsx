"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { TRANSOVO_VIDEO_LOCATION_LABEL } from "@/lib/transovo-video/types";

type Props = {
  form: AppointmentTypeFormState;
  onChange: <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => void;
};

export function EventTypeVideoSettings({ form, onChange }: Props) {
  const enabled =
    form.transovoVideoEnabled || form.location === TRANSOVO_VIDEO_LOCATION_LABEL;
  if (!enabled) return null;

  return (
    <Card className="mt-4 space-y-3 border-dashed p-4">
      <div>
        <h3 className="text-sm font-semibold">Transovo Video settings</h3>
        <p className="text-xs text-muted-foreground">
          Native browser meetings — no Zoom or Meet account required.
        </p>
      </div>
      <div>
        <Label>Maximum participants (2–50)</Label>
        <Input
          type="number"
          min={2}
          max={50}
          value={form.videoMaxParticipants || 10}
          onChange={(e) => onChange("videoMaxParticipants", Number(e.target.value) || 10)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.videoRequireGuestEmail)}
          onChange={(e) => onChange("videoRequireGuestEmail", e.target.checked)}
        />
        Require guest email
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.videoRequireHost)}
          onChange={(e) => onChange("videoRequireHost", e.target.checked)}
        />
        Require host to join first
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.videoWaitingRoom)}
          onChange={(e) => onChange("videoWaitingRoom", e.target.checked)}
        />
        Waiting room
      </label>
      <div>
        <Label>Recording</Label>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={form.videoRecordingMode || "off"}
          onChange={(e) =>
            onChange("videoRecordingMode", e.target.value as AppointmentTypeFormState["videoRecordingMode"])
          }
        >
          <option value="off">Off</option>
          <option value="manual">Host can record</option>
          <option value="automatic">Automatically record</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.videoTranscription)}
          onChange={(e) => onChange("videoTranscription", e.target.checked)}
        />
        Generate transcript
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.videoAiRecap)}
          onChange={(e) => onChange("videoAiRecap", e.target.checked)}
        />
        Generate AI meeting recap
      </label>
    </Card>
  );
}
