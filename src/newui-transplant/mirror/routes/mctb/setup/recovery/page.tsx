'use client'

import { FieldRow, Panel } from '@/newui-transplant/components/app/kit'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { Button } from '@/newui-transplant/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/newui-transplant/components/ui/select'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'

export type MctbSetupRecoveryWired = {
  paused?: boolean
  triggers: Array<{ label: string; on: boolean; onChange: (v: boolean) => void }>
  delayLabel: string
  cooldownLabel: string
  maxMessagesLabel: string
  onDelayChange?: (label: string) => void
  onCooldownChange?: (label: string) => void
  onMaxMessagesChange?: (label: string) => void
  onPausePreset?: (preset: '1 hour' | 'Until tomorrow' | '1 week' | 'Indefinitely') => void
  onResume?: () => Promise<void>
  onSave?: () => Promise<void>
}

const DEMO_TRIGGERS = [
  { label: 'No answer', on: true },
  { label: 'Busy', on: true },
  { label: 'Rejected / declined', on: true },
  { label: 'Unreachable', on: true },
  { label: 'After voicemail', on: true },
  { label: 'Blocked caller ID', on: false },
]

function Choice({
  id,
  options,
  value,
  onValueChange,
}: {
  id: string
  options: string[]
  value: string
  onValueChange?: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange} items={options.map((o) => ({ label: o, value: o }))}>
      <SelectTrigger aria-label={id} className="w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function TransplantMctbSetupRecoveryPage({ wired }: { wired?: MctbSetupRecoveryWired }) {
  const triggers = wired?.triggers ?? DEMO_TRIGGERS.map((t) => ({ ...t, onChange: () => {} }))
  const delay = wired?.delayLabel ?? '30 seconds'
  const cooldown = wired?.cooldownLabel ?? '24 hours'
  const maxMsg = wired?.maxMessagesLabel ?? '3'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Recovery triggers" description="Send a recovery text when a call ends like this">
        <ul className="grid gap-3 sm:grid-cols-2">
          {triggers.map((t) => (
            <li key={t.label}>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={t.on} onCheckedChange={(v) => t.onChange(Boolean(v))} /> {t.label}
              </label>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pause recovery">
        <p className="mb-3 text-sm text-muted-foreground">
          {wired?.paused
            ? 'Recovery is paused. Forwarded calls use your voicemail fallback — no recovery SMS.'
            : 'Recovery is running. Pause temporarily or indefinitely.'}
        </p>
        {wired?.paused ? (
          <Button type="button" onClick={() => void wired?.onResume?.()}>
            Resume recovery
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(['1 hour', 'Until tomorrow', '1 week', 'Indefinitely'] as const).map((p) => (
              <Button key={p} variant="outline" size="sm" type="button" onClick={() => wired?.onPausePreset?.(p)}>
                {p}
              </Button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Timing & follow-up" className="lg:col-span-2">
        <div className="divide-y">
          <FieldRow label="Recovery delay" description="Wait before sending, in case your team calls back first">
            <Choice
              id="Recovery delay"
              options={['Immediately', '30 seconds', '1 minute', '5 minutes']}
              value={delay}
              onValueChange={wired?.onDelayChange}
            />
          </FieldRow>
          <FieldRow label="Cooldown" description="Don’t text the same caller again within this window">
            <Choice
              id="Cooldown"
              options={['30 minutes', '1 hour', '3 hours', '6 hours', '12 hours', '24 hours', '7 days']}
              value={cooldown}
              onValueChange={wired?.onCooldownChange}
            />
          </FieldRow>
          <FieldRow label="Max automated messages" description="Per missed call, before a human takes over">
            <Choice
              id="Max automated messages"
              options={['1', '2', '3', '5']}
              value={maxMsg}
              onValueChange={wired?.onMaxMessagesChange}
            />
          </FieldRow>
        </div>
        <div className="mt-4 flex justify-end">
          <SaveBar label="Save follow-up rules" onSave={wired?.onSave} />
        </div>
      </Panel>
    </div>
  )
}
