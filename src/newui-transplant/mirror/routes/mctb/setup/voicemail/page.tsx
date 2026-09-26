import { Mic, Play, Type, Upload, Waves } from 'lucide-react'
import { FieldRow, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'

export const metadata: Metadata = { title: 'Voicemail Setup' }

const SOURCES = [
  { icon: Type, label: 'Text to speech', active: true },
  { icon: Waves, label: 'ElevenLabs voice' },
  { icon: Mic, label: 'Record' },
  { icon: Upload, label: 'Upload' },
]

export function TransplantMctbSetupVoicemailPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Greeting" description="What callers hear before leaving a message" action={<Pill tone="warning">Not active</Pill>} className="lg:col-span-2">
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
          defaultValue="You've reached Northside Plumbing & Heating. Leave your name, number, and what you need, and we'll text you right back."
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline"><Play /> Preview</Button>
          <SaveBar label="Activate greeting" />
        </div>
      </Panel>
      <Panel title="After a voicemail">
        <FieldRow label="Send recovery text" description="Text the caller after they leave a message">
          <Switch defaultChecked aria-label="Send recovery text after voicemail" />
        </FieldRow>
      </Panel>
      <Panel title="Transcription">
        <FieldRow label="Transcribe voicemail" description="Adds a transcript and AI summary">
          <Switch defaultChecked aria-label="Transcribe voicemail" />
        </FieldRow>
      </Panel>
    </div>
  )
}
