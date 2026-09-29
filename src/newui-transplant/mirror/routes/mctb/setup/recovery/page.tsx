'use client'

import { useMemo } from 'react'
import { Panel, SettingRow } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { mctbMaxMessagesSelectOptions } from '@/lib/mctb/recovery-max-messages'
import { Button } from '@/newui-transplant/components/ui/button'
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

export function TransplantMctbSetupRecoveryPage({ wired }: { wired?: MctbSetupRecoveryWired }) {
  const delay = wired?.delayLabel ?? '30 seconds'
  const cooldown = wired?.cooldownLabel ?? '24 hours'
  const maxMsg = wired?.maxMessagesLabel ?? '3'
  const maxMsgOptions = useMemo(() => mctbMaxMessagesSelectOptions(Number(maxMsg) || 3), [maxMsg])
  const maxResolved = maxMsgOptions.includes(maxMsg) ? maxMsg : maxMsgOptions[maxMsgOptions.length - 1]!

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pause recovery" className="lg:col-span-2">
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

      <Panel title="Timing & follow-up" className="lg:col-span-2" bodyClassName="p-0">
        <div className="divide-y px-5">
          <SettingRow
            title="Recovery delay"
            description="Wait before sending, in case your team calls back first"
            control={
              <SimpleSelect
                label="Recovery delay"
                className="w-40"
                value={delay}
                options={['Immediately', '30 seconds', '1 minute', '5 minutes'].map((o) => ({ value: o, label: o }))}
                onChange={(v) => wired?.onDelayChange?.(v)}
              />
            }
          />
          <SettingRow
            title="Cooldown"
            description="Don’t text the same caller again within this window"
            control={
              <SimpleSelect
                label="Cooldown"
                className="w-40"
                value={cooldown}
                options={['30 minutes', '1 hour', '3 hours', '6 hours', '12 hours', '24 hours', '7 days'].map((o) => ({
                  value: o,
                  label: o,
                }))}
                onChange={(v) => wired?.onCooldownChange?.(v)}
              />
            }
          />
          <SettingRow
            title="Max automated recovery texts"
            description="Same caller — within the cooldown window above. Does not include Press-1 compliance texts."
            control={
              <SimpleSelect
                label="Max automated recovery texts"
                className="w-24"
                value={maxResolved}
                options={maxMsgOptions.map((o) => ({ value: o, label: o }))}
                onChange={(v) => wired?.onMaxMessagesChange?.(v)}
              />
            }
          />
        </div>
        <div className="flex justify-end border-t px-5 py-4">
          <SaveBar label="Save follow-up rules" onSave={wired?.onSave} />
        </div>
      </Panel>
    </div>
  )
}
