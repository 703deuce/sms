'use client'

import { Panel, SettingRow } from '@/newui-transplant/components/app/kit'
import { OPUS_INSET_LIST } from '@/newui-transplant/components/app/opus-surfaces'
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
      <ul className={OPUS_INSET_LIST}>
        {triggers.map((t) => (
          <li key={t.label} className="px-5">
            <SettingRow
              title={t.label}
              control={
                <Checkbox
                  checked={t.on}
                  onCheckedChange={(v) => t.onChange(Boolean(v))}
                  aria-label={t.label}
                />
              }
            />
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t px-5 py-4">
        <SaveBar label="Save rules" onSave={wired?.onSave} />
      </div>
    </Panel>
  )
}
