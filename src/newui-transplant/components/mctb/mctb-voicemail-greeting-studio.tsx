"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { PersonalOutlineButton } from "@/components/personal/personal-ui";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { clientPlatformVoicemailGreetingPreviewPath } from "@/lib/phone/voicemail-greeting-defaults";

type Props = {
  greetingText: string;
  greetingUrl: string | null;
  greetingActive: boolean;
  greetingCustomActive: boolean;
  onSaveText: (text: string) => Promise<void>;
  onSaveUrl: (url: string) => Promise<void>;
  onUsePlatformDefault?: () => Promise<void>;
};

export function MctbVoicemailGreetingStudio({
  greetingText,
  greetingUrl,
  greetingActive,
  greetingCustomActive,
  onSaveText,
  onSaveUrl,
  onUsePlatformDefault,
}: Props) {
  const platformPreviewUrl = clientPlatformVoicemailGreetingPreviewPath();

  const sourceLabel = greetingCustomActive
    ? "Your custom greeting"
    : "Transovo default greeting";

  const statusPill = !greetingActive
    ? { tone: "warning" as const, label: "Not ready" }
    : greetingCustomActive
      ? { tone: "success" as const, label: "Active — your greeting" }
      : { tone: "success" as const, label: "Active — Transovo default" };

  return (
    <Panel
      title="Current voicemail greeting"
      description="Callers hear this greeting when the call goes to voicemail, then can leave a message."
      action={<Pill tone={statusPill.tone}>{statusPill.label}</Pill>}
      className="lg:col-span-2"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Source: <span className="font-medium text-foreground">{sourceLabel}</span>
      </p>

      {greetingUrl ? (
        <div className="mb-4 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your active greeting
          </p>
          <audio className="w-full max-w-md" controls src={greetingUrl} />
        </div>
      ) : (
        <div className={`mb-4 space-y-2 bg-muted/30 p-3 ${OPUS_CARD}`}>
          <p className="text-sm text-muted-foreground">
            No custom greeting yet. Callers hear the Transovo default until you activate your own.
          </p>
          <audio className="w-full max-w-md" controls src={platformPreviewUrl} />
          {onUsePlatformDefault ? (
            <PersonalOutlineButton onClick={() => void onUsePlatformDefault()}>
              Use Transovo default
            </PersonalOutlineButton>
          ) : null}
        </div>
      )}

      {greetingCustomActive && onUsePlatformDefault ? (
        <div className="mb-4">
          <PersonalOutlineButton onClick={() => void onUsePlatformDefault()}>
            Revert to Transovo default
          </PersonalOutlineButton>
        </div>
      ) : null}

      <PersonalGreetingControls
        premiumTabs
        activationMode="explicit"
        greetingText={greetingText}
        greetingUrl={greetingUrl}
        onSaveText={onSaveText}
        onSaveUrl={onSaveUrl}
        assetName="MCTB voicemail greeting"
        emptyHint="Create a custom greeting below, or keep the Transovo default above."
        scriptPlaceholder="Thanks for calling. Please leave your name, number, and how we can help."
        createButtonLabel="Generate greeting"
      />
    </Panel>
  );
}
