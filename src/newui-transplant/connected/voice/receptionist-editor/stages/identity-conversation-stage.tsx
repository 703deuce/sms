"use client";

import { VoiceStep } from "@/components/solutions/appointment-receptionist/steps/voice-step";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";

export function IdentityConversationStage({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const selectedVoice = state.voiceLabel || "Not selected";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Panel title="Identity" description="The name and role callers know your receptionist by.">
            <VoiceStep
              state={state}
              patch={patch}
              presentation="opus"
              parts={["identity"]}
              showSidePanel={false}
            />
          </Panel>
        </div>
        <div className="lg:col-span-7">
          <Panel
            title="Voice"
            description="Choose how your receptionist sounds on live calls."
            action={<Pill tone="neutral">{selectedVoice}</Pill>}
          >
            <VoiceStep
              state={state}
              patch={patch}
              presentation="opus"
              parts={["voice"]}
              showSidePanel={false}
              opusVoiceSlice="picks"
            />
          </Panel>
        </div>
      </div>

      <Panel title="Conversation style" description="GPT-Live instruction controls for pace and turn-taking.">
        <VoiceStep
          state={state}
          patch={patch}
          presentation="opus"
          parts={["voice"]}
          showSidePanel={false}
          opusVoiceSlice="prompts"
        />
      </Panel>

      <Panel title="Greeting">
        <VoiceStep
          state={state}
          patch={patch}
          presentation="opus"
          parts={["greeting"]}
          showSidePanel={false}
        />
      </Panel>
    </div>
  );
}
