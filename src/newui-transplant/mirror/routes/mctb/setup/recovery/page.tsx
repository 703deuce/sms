'use client'

import { useMemo } from 'react'
import { Clock, PauseCircle, PlayCircle } from 'lucide-react'
import { ConfigSection, SettingRow } from '@/newui-transplant/components/app/kit'
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

const PAUSE_PRESETS = ['1 hour', 'Until tomorrow', '1 week', 'Indefinitely'] as const

export function TransplantMctbSetupRecoveryPage({ wired }: { wired?: MctbSetupRecoveryWired }) {
  const delay = wired?.delayLabel ?? '30 seconds'
  const cooldown = wired?.cooldownLabel ?? '24 hours'
  const maxMsg = wired?.maxMessagesLabel ?? '3'
  const maxMsgOptions = useMemo(() => mctbMaxMessagesSelectOptions(Number(maxMsg) || 3), [maxMsg])
  const maxResolved = maxMsgOptions.includes(maxMsg) ? maxMsg : maxMsgOptions[maxMsgOptions.length - 1]!
  const paused = Boolean(wired?.paused)

  return (
    <div className="flex flex-col gap-8">
      <ConfigSection
        icon={paused ? PauseCircle : PlayCircle}
        title="Pause recovery"
        description="Stop automated recovery texts. Forwarded calls can still reach voicemail."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {paused
                ? 'Recovery is paused. No recovery SMS will send until you resume.'
                : 'Recovery is active. Pause temporarily if your team cannot respond.'}
            </p>
          </div>
          {paused ? (
            <Button type="button" className="shrink-0" onClick={() => void wired?.onResume?.()}>
              Resume recovery
            </Button>
          ) : (
            <div
              className="flex shrink-0 flex-col gap-2 sm:items-end"
              role="group"
              aria-label="Pause recovery for"
            >
              <span className="text-xs font-medium text-muted-foreground">Pause for</span>
              <div className="flex flex-wrap gap-1.5">
                {PAUSE_PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant="secondary"
                    size="sm"
                    type="button"
                    className="h-8 bg-background shadow-sm"
                    onClick={() => wired?.onPausePreset?.(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection
        icon={Clock}
        title="Timing & follow-up"
        description="Delay, cooldown, and repeat-send limits apply to future recovery attempts."
        insetClassName="p-0"
      >
        <div className="divide-y px-4 sm:px-5">
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
            description="Same caller within the cooldown window. Excludes Press-1 compliance texts."
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
        <div className="flex justify-end border-t border-border/60 px-4 py-4 sm:px-5">
          <SaveBar label="Save follow-up rules" onSave={wired?.onSave} />
        </div>
      </ConfigSection>
    </div>
  )
}
