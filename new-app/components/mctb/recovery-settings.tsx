'use client'

import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { Checkbox } from '@/components/ui/checkbox'
import { useMctbSettings } from '@/components/mctb/use-mctb-settings'

export function RecoverySettings() {
  const { data, loading, saving, save } = useMctbSettings()

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Loading recovery controls…</p>
  }

  const triggers = data.recovery.triggers

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Panel title="Operational mode">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="mctb-master">Recovery enabled (workspace)</Label>
          <Switch
            id="mctb-master"
            checked={data.recovery.active}
            disabled={saving}
            onCheckedChange={(on) => {
              void save({ recovery: { enabled: on } }).then(() => toast.success('Saved'))
            }}
          />
        </div>
        {data.recovery.manuallyPaused && (
          <p className="mt-2 text-xs text-amber-600">Recovery is paused until you resume in Recovery Controls.</p>
        )}
      </Panel>

      <Panel title="Follow-up rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Initial delay (seconds)
            <input
              type="number"
              className="rounded-md border px-2 py-1"
              value={data.recovery.delaySeconds}
              disabled={saving}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isFinite(v)) return
                void save({ recovery: { delaySeconds: v } })
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Cooldown (minutes)
            <input
              type="number"
              className="rounded-md border px-2 py-1"
              value={data.recovery.cooldownMinutes}
              disabled={saving}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isFinite(v)) return
                void save({ recovery: { cooldownMinutes: v } })
              }}
            />
          </label>
        </div>
      </Panel>

      <Panel title="What counts as missed">
        <ul className="flex flex-col gap-2">
          {(
            [
              ['noAnswer', 'No answer'],
              ['busy', 'Busy'],
              ['rejected', 'Rejected'],
              ['unreachable', 'Unreachable'],
              ['voicemail', 'After voicemail'],
            ] as const
          ).map(([key, label]) => (
            <li key={key} className="flex items-center gap-2">
              <Checkbox
                id={`tr-${key}`}
                checked={triggers[key]}
                disabled={saving}
                onCheckedChange={(on) => {
                  void save({
                    recovery: {
                      triggers: { ...triggers, [key]: on === true },
                    },
                  })
                }}
              />
              <Label htmlFor={`tr-${key}`}>{label}</Label>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pause">
        <SimpleSelect
          label="Pause preset"
          value={data.recovery.manuallyPaused ? 'paused' : 'active'}
          onChange={(v) => {
            if (v === 'paused') {
              void save({ recovery: { manuallyPaused: true } })
            } else {
              void save({ recovery: { manuallyPaused: false, pauseUntil: null } })
            }
          }}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ]}
        />
      </Panel>
    </div>
  )
}
