"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Card } from "@/components/ui/card";
import { mctbVoiceAgentStepHref } from "@/lib/mctb/voice-agent/wizard-deep-links";
import Link from "next/link";

export function RecordingConfigCard({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Call recording</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        When enabled, calls can be recorded for playback on the call detail page. Playback quality
        depends on your telephony setup.
      </p>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border"
          checked={state.callRecording === true}
          onChange={(e) => patch({ callRecording: e.target.checked })}
        />
        <span>
          <span className="font-medium">Record calls</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Uses the same setting as AI agent setup → Phone. Save changes on this page to apply.
          </span>
        </span>
      </label>
      <p className="mt-3 text-xs">
        <Link href={mctbVoiceAgentStepHref("phone")} className="text-primary underline">
          Open full phone settings
        </Link>
      </p>
    </Card>
  );
}
