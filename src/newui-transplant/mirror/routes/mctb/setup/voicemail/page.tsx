'use client'

import { FieldRow, Panel } from '@/newui-transplant/components/app/kit'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { MctbVoicemailGreetingStudio } from '@/newui-transplant/components/mctb/mctb-voicemail-greeting-studio'

export type MctbSetupVoicemailWired = {
  greetingText: string
  greetingUrl?: string | null
  onGreetingTextChange: (v: string) => void
  greetingActive: boolean
  greetingCustomActive?: boolean
  sendAfterVoicemail: boolean
  onSendAfterVoicemailChange: (v: boolean) => void
  transcriptionEnabled?: boolean
  onTranscriptionEnabledChange?: (v: boolean) => void
  onSaveGreeting?: (textOverride?: string) => Promise<void>
  onSaveGreetingUrl?: (url: string) => Promise<void>
  onUsePlatformDefaultGreeting?: () => Promise<void>
  onSaveRecoveryToggle?: () => Promise<void>
}

export function TransplantMctbSetupVoicemailPage({ wired }: { wired?: MctbSetupVoicemailWired }) {
  const greetingText = wired?.greetingText ?? ''
  const active = wired?.greetingActive ?? false

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {wired?.onSaveGreeting && wired?.onSaveGreetingUrl ? (
        <MctbVoicemailGreetingStudio
          greetingText={greetingText}
          greetingUrl={wired.greetingUrl ?? null}
          greetingActive={active}
          greetingCustomActive={wired.greetingCustomActive ?? Boolean(wired.greetingUrl)}
          onSaveText={async (text) => {
            wired.onGreetingTextChange(text)
            await wired.onSaveGreeting?.(text)
          }}
          onSaveUrl={wired.onSaveGreetingUrl}
          onUsePlatformDefault={wired.onUsePlatformDefaultGreeting}
        />
      ) : null}
      <Panel title="After a voicemail">
        <FieldRow label="Send recovery text" description="Text the caller after they leave a message">
          <Switch
            checked={wired?.sendAfterVoicemail ?? true}
            onCheckedChange={(v) => {
              wired?.onSendAfterVoicemailChange(v)
              void wired?.onSaveRecoveryToggle?.()
            }}
            aria-label="Send recovery text after voicemail"
          />
        </FieldRow>
      </Panel>
      <Panel title="Transcription">
        <FieldRow label="Transcribe voicemail" description="Adds a transcript and AI summary">
          <Switch
            checked={wired?.transcriptionEnabled ?? true}
            onCheckedChange={(v) => {
              wired?.onTranscriptionEnabledChange?.(v)
            }}
            aria-label="Transcribe voicemail"
          />
        </FieldRow>
      </Panel>
    </div>
  )
}
