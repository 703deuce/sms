'use client'

import { Panel } from '@/newui-transplant/components/app/kit'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'

export type MctbSetupMissedCallRulesWired = {
  triggers: Array<{ label: string; on: boolean; onChange: (v: boolean) => void }>
  onSave?: () => Promise<void>
}

export function TransplantMctbSetupMissedCallRulesPage({ wired }: { wired?: MctbSetupMissedCallRulesWired }) {
  const triggers = wired?.triggers ?? []

  return (
    <Panel title="What counts as a missed call" description="Create a recovery event when a forwarded call ends like this. Cooldown and pause live under Recovery.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {triggers.map((t) => (
          <li key={t.label}>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={t.on} onCheckedChange={(v) => t.onChange(Boolean(v))} /> {t.label}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <SaveBar label="Save rules" onSave={wired?.onSave} />
      </div>
    </Panel>
  )
}
