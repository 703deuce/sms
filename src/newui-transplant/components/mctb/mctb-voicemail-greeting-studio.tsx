"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";

type Props = {
  greetingText: string;
  greetingUrl: string | null;
  greetingActive: boolean;
  onSaveText: (text: string) => Promise<void>;
  onSaveUrl: (url: string) => Promise<void>;
};

export function MctbVoicemailGreetingStudio({
  greetingText,
  greetingUrl,
  greetingActive,
  onSaveText,
  onSaveUrl,
}: Props) {
  const sourceLabel = greetingUrl ? "Uploaded or recorded audio" : greetingText ? "Generated / script" : "Default";

  return (
    <Panel
      title="Current voicemail greeting"
      description="One active greeting for the existing-consent voicemail path. Authoritative audio is voicemailBox.greetingUrl, copied to the stable carrier play URL on activate (provisionActiveVoicemailGreeting)."
      action={<Pill tone={greetingActive ? "success" : "warning"}>{greetingActive ? "Active" : "Not active"}</Pill>}
      className="lg:col-span-2"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Source: <span className="font-medium text-foreground">{sourceLabel}</span>
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Record, upload, or generate with ElevenLabs, then use <span className="font-medium">Use this greeting</span> to
        activate. Callers hear that audio on the certified voicemail play URL — not a separate draft field.
      </p>
      <PersonalGreetingControls
        premiumTabs
        activationMode="explicit"
        greetingText={greetingText}
        greetingUrl={greetingUrl}
        onSaveText={onSaveText}
        onSaveUrl={onSaveUrl}
        assetName="MCTB voicemail greeting"
        emptyHint="Record, upload, or generate a greeting — then activate it for callers."
        scriptPlaceholder="Thanks for calling. Please leave your name, number, and how we can help."
        createButtonLabel="Generate greeting"
      />
    </Panel>
  );
}
