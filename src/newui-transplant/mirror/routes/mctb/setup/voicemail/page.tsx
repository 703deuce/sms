'use client'

import { Panel, SettingRow } from '@/newui-transplant/components/app/kit'
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
  mentionSmsInGreeting?: boolean
  onMentionSmsInGreetingChange?: (v: boolean) => void
  onSaveMentionSmsToggle?: () => Promise<void>
  smsReinforcementPreview?: string
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
      <Panel title="Text recovery in voicemail" bodyClassName="p-0">
        <div className="px-5">
          <SettingRow
            title="Tell callers to reply to the text"
            description="Adds a short line that a text was sent and replying is the fastest way to share details."
            control={
              <Switch
                checked={wired?.mentionSmsInGreeting ?? true}
                onCheckedChange={(v) => {
                  wired?.onMentionSmsInGreetingChange?.(Boolean(v))
                  void wired?.onSaveMentionSmsToggle?.()
                }}
                aria-label="Mention SMS in voicemail greeting"
              />
            }
          />
          {wired?.smsReinforcementPreview ? (
            <p className="pb-4 text-xs leading-relaxed text-muted-foreground">
              Preview: {wired.smsReinforcementPreview}
            </p>
          ) : null}
        </div>
      </Panel>
      <Panel title="After a voicemail" bodyClassName="p-0">
        <div className="px-5">
        <SettingRow
          title="Send recovery text"
          description="Text the caller after they leave a message"
          control={
            <Switch
              checked={wired?.sendAfterVoicemail ?? true}
              onCheckedChange={(v) => {
                wired?.onSendAfterVoicemailChange(v)
                void wired?.onSaveRecoveryToggle?.()
              }}
              aria-label="Send recovery text after voicemail"
            />
          }
        />
        </div>
      </Panel>
      <Panel title="Transcription" bodyClassName="p-0">
        <div className="px-5">
        <SettingRow
          title="Transcribe voicemail"
          description="Adds a transcript and AI summary"
          control={
            <Switch
              checked={wired?.transcriptionEnabled ?? true}
              onCheckedChange={(v) => {
                wired?.onTranscriptionEnabledChange?.(v)
              }}
              aria-label="Transcribe voicemail"
            />
          }
        />
        </div>
      </Panel>
    </div>
  )
}
