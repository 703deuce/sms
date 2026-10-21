'use client'

import Link from 'next/link'
import { CircleDot, FlaskConical, PhoneCall, PhoneForwarded, Rocket, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { useResolvedConnection } from '@/components/numbers/number-picker'
import { formatPhone, formatWhen } from '@/lib/format'
import { AgentStatusBadge } from './ai-ui'
import { receptionistModeStatusCopy, resolveRuntimeProfile } from '@/lib/receptionist/runtime-profile'

/** Live agent card for the Overview: status, connected number, and draft state. */
export function OverviewStatus() {
  const { live, draft, changes, status, lastPublished, unsaved } = useAgent()
  const modeCopy = receptionistModeStatusCopy({
    draftProfile: resolveRuntimeProfile(draft),
    liveProfile: resolveRuntimeProfile(live),
    hasUnpublishedDraft: changes.length > 0 || unsaved,
  })
  const conn = useResolvedConnection(live.connection)

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-xl surface p-5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <IconTile icon={conn?.kind === 'external' ? PhoneForwarded : PhoneCall} tone="primary" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {live.identity.name} · {live.identity.role}
            <AgentStatusBadge />
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {conn ? <span className="tabular-nums">{formatPhone(conn.number)}</span> : 'No number'}
            {conn && ` · ${conn.label}`} · published {formatWhen(lastPublished)}
          </span>
          <span className="text-xs text-muted-foreground">{modeCopy.liveLine}</span>
          {resolveRuntimeProfile(draft) !== resolveRuntimeProfile(live) && (
            <StatusBadge tone="warning" className="self-start">{modeCopy.editingLine}</StatusBadge>
          )}
          {changes.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <CircleDot className="size-3" aria-hidden />
              {changes.length} draft {changes.length === 1 ? 'change' : 'changes'} waiting to publish
            </span>
          )}
          {status === 'paused' && <StatusBadge tone="warning" className="self-start">Calls follow Phone routing while paused</StatusBadge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" render={<Link href="/app/receptionist/agent" />}><Settings2 data-icon="inline-start" />Voice & greeting</Button>
        <Button variant="outline" size="sm" render={<Link href="/app/receptionist/test" />}><FlaskConical data-icon="inline-start" />Test agent</Button>
        {changes.length > 0 && <Button size="sm" render={<Link href="/app/receptionist/activate" />}><Rocket data-icon="inline-start" />Review & publish</Button>}
      </div>
    </section>
  )
}
