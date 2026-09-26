'use client'

import { Mic, Play, Type, Upload, Waves } from 'lucide-react'
import { FieldRow, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'

export type MctbSetupVoicemailWired = {
  greetingText: string
  onGreetingTextChange: (v: string) => void
  greetingActive: boolean
  sendAfterVoicemail: boolean
  onSendAfterVoicemailChange: (v: boolean) => void
  transcriptionEnabled?: boolean
  onTranscriptionEnabledChange?: (v: boolean) => void
  onSaveGreeting?: () => Promise<void>
  onSaveRecoveryToggle?: () => Promise<void>
}

const SOURCES = [
  { icon: Type, label: 'Text to speech', active: true },
  { icon: Waves, label: 'ElevenLabs voice' },
  { icon: Mic, label: 'Record' },
  { icon: Upload, label: 'Upload' },
]

export function TransplantMctbSetupVoicemailPage({ wired }: { wired?: MctbSetupVoicemailWired }) {
  const greeting =
    wired?.greetingText ??
    "You've reached Northside Plumbing & Heating. Leave your name, number, and what you need, and we'll text you right back."
  const active = wired?.greetingActive ?? false

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Greeting"
        description="What callers hear before leaving a message"
        action={<Pill tone={active ? 'success' : 'warning'}>{active ? 'Active' : 'Not active'}</Pill>}
        className="lg:col-span-2"
      >
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOURCES.map((s) => (
            <button
              key={s.label}
              type="button"
              aria-pressed={Boolean(s.active)}
              className={
                s.active
                  ? 'flex flex-col items-center gap-2 rounded-lg border border-primary bg-accent/50 p-4 text-sm font-medium ring-1 ring-primary'
                  : 'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground hover:bg-muted/50'
              }
            >
              <s.icon className="size-5" aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="greeting" className="mb-1.5 block text-sm font-medium">Greeting script</label>
        <Textarea
          id="greeting"
          rows={3}
          value={greeting}
          onChange={(e) => wired?.onGreetingTextChange(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button"><Play /> Preview</Button>
          <SaveBar label="Activate greeting" onSave={wired?.onSaveGreeting} />
        </div>
      </Panel>
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
