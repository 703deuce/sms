'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Panel } from '@/components/app/page-primitives'
import { OptionGroup } from '@/components/app/option-group'
import { StatusBadge } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { TRANSFERS, type RoutePolicy } from '@/lib/data'
import { formatPhone } from '@/lib/format'

export function AiCoverageEditor() {
  const { routePolicy, updateRoutePolicy } = useWorkspace()
  const [transfers, setTransfers] = useState(TRANSFERS)

  const setCoverage = (v: RoutePolicy['aiCoverage']) => {
    const patch: Partial<RoutePolicy> = { aiCoverage: v }
    if (v === 'off') {
      if (routePolicy.noAnswer === 'ai') patch.noAnswer = 'voicemail'
      if (routePolicy.afterHours === 'ai') patch.afterHours = 'voicemail'
      if (routePolicy.duringHours === 'ai') patch.duringHours = 'ring_group'
    }
    if (v === 'full_time') patch.duringHours = 'ai'
    if (v === 'after_hours' || v === 'after_hours_overflow') patch.afterHours = 'ai'
    if (v === 'overflow' || v === 'after_hours_overflow') patch.noAnswer = 'ai'
    if (v !== 'full_time' && routePolicy.duringHours === 'ai') patch.duringHours = 'ring_group'
    updateRoutePolicy(patch, 'AI Receptionist')
    toast.success('AI coverage updated', { description: 'Phone call handling was updated to match.' })
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="When should Ava answer?" description="Applies to the Main line. Phone routing updates automatically.">
        <OptionGroup
          label="Coverage"
          value={routePolicy.aiCoverage}
          onChange={setCoverage}
          options={[
            { value: 'after_hours_overflow', label: 'After hours + overflow', description: 'Recommended. Team first, Ava when nobody picks up or the office is closed.' },
            { value: 'after_hours', label: 'After hours only', description: 'Ava answers only when the office is closed.' },
            { value: 'overflow', label: 'Overflow only', description: 'Ava answers when the ring group times out or is busy.' },
            { value: 'full_time', label: 'Full-time', description: 'Ava answers every call and transfers as needed.' },
            { value: 'off', label: 'Off', description: 'Calls follow Phone routing to voicemail.' },
          ]}
        />
      </Panel>

      <Panel title="Live transfers" description="Where Ava can hand off a caller. A transfer only counts when the destination answers.">
        <ul className="divide-y">
          {transfers.map((t) => (
            <li key={t.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  <span className="font-mono text-xs font-normal text-muted-foreground">{formatPhone(t.number)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{t.scenario}</span>
              </span>
              <Switch
                checked={t.enabled}
                onCheckedChange={(v) => setTransfers((xs) => xs.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)))}
                aria-label={`Enable transfer to ${t.name}`}
              />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="If Ava can't resolve the call">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>Take a message and create a callback task</span>
            <StatusBadge tone="success">On</StatusBadge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Then offer Missed Call Text Back</span>
            <StatusBadge tone={routePolicy.mctbEnabled ? 'success' : 'muted'}>{routePolicy.mctbEnabled ? 'On' : 'Off'}</StatusBadge>
          </div>
        </div>
      </Panel>
    </div>
  )
}
