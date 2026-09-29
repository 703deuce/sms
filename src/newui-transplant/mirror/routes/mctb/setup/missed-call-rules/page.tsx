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
    <Panel
      title="What counts as a missed call"
      description="Create a recovery event when a forwarded call ends like this. Cooldown and pause live under Recovery."
      bodyClassName="p-0"
    >
      <ul className="grid gap-0 divide-y sm:grid-cols-2 sm:divide-y-0">
        {triggers.map((t) => (
          <li key={t.label} className="px-5 py-3 sm:border-b sm:last:border-b-0">
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <Checkbox checked={t.on} onCheckedChange={(v) => t.onChange(Boolean(v))} /> {t.label}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t px-5 py-4">
        <SaveBar label="Save rules" onSave={wired?.onSave} />
      </div>
    </Panel>
  )
}
