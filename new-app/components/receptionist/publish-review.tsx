'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, FlaskConical, Loader2, PauseCircle, PlayCircle, RefreshCw, Rocket, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { useResolvedConnection } from '@/components/numbers/number-picker'
import { Callout } from '@/components/numbers/number-ui'
import type { AgentConfig } from '@/lib/agent'
import { formatPhone, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AgentStatusBadge } from './ai-ui'

const EDIT_HREF: Partial<Record<keyof AgentConfig, string>> = {
  identity: '/app/receptionist/agent#identity',
  style: '/app/receptionist/agent#style',
  capabilities: '/app/receptionist/agent#capabilities',
  intake: '/app/receptionist/agent#intake',
  qualification: '/app/receptionist/agent#intake',
  instructions: '/app/receptionist/agent#instructions',
  memory: '/app/receptionist/agent#memory',
  crmWrite: '/app/receptionist/agent#memory',
  appointments: '/app/receptionist/appointments',
  connection: '/app/receptionist/call-handling',
  coverage: '/app/receptionist/call-handling#coverage',
  transfers: '/app/receptionist/call-handling#transfers',
  triggers: '/app/receptionist/call-handling#transfers',
  customTrigger: '/app/receptionist/call-handling#transfers',
  transferStyle: '/app/receptionist/call-handling#transfers',
  messages: '/app/receptionist/call-handling#messages',
  recovery: '/app/receptionist/call-handling#recovery',
  protection: '/app/receptionist/call-handling#protection',
  audio: '/app/receptionist/call-handling#advanced',
}

type Check = { label: string; state: 'pass' | 'warn' | 'fail'; detail: string; href?: string }

export function PublishReview() {
  const { draft, live, changes, unsaved, status, publish, setPaused, lastPublished } = useAgent()
  const router = useRouter()
  const conn = useResolvedConnection(draft.connection)
  const [simulateFail, setSimulateFail] = useState(false)
  const [tested, setTested] = useState(false)

  const caps = draft.capabilities
  const checks: Check[] = [
    { label: 'Phone number', state: !conn ? 'fail' : conn.verified ? 'pass' : 'warn', detail: conn ? `${formatPhone(conn.number)} · ${conn.statusLabel}` : 'No number connected', href: '/app/receptionist/call-handling' },
    { label: 'Voice', state: draft.identity.customVoiceId && !/^voice_\w{6,}$/.test(draft.identity.customVoiceId) ? 'fail' : 'pass', detail: draft.identity.customVoiceId ? `Custom ${draft.identity.customVoiceId}` : 'Library voice', href: '/app/receptionist/agent#identity' },
    { label: 'Greeting', state: draft.identity.greeting.trim().length > 10 ? 'pass' : 'fail', detail: draft.identity.greeting.trim() ? 'Opening line set' : 'Opening line is empty', href: '/app/receptionist/agent#greeting' },
    { label: 'Knowledge', state: caps.answer ? 'warn' : 'pass', detail: caps.answer ? 'Verify FAQs and sources on the Knowledge page before publish' : 'Answering questions is off', href: '/app/receptionist/knowledge' },
    { label: 'Booking', state: !caps.book ? 'pass' : draft.appointments.provider === 'none' && draft.appointments.strategy === 'live' ? 'fail' : draft.appointments.types.some((t) => t.enabled) ? 'pass' : 'warn', detail: !caps.book ? 'Booking is off' : `${draft.appointments.types.filter((t) => t.enabled).length} active types · ${draft.appointments.strategy === 'live' ? 'live calendar' : draft.appointments.strategy}`, href: '/app/receptionist/appointments' },
    { label: 'Transfers', state: !caps.transfer ? 'pass' : draft.transfers.some((t) => t.enabled) ? 'pass' : 'fail', detail: !caps.transfer ? 'Transfers are off' : `${draft.transfers.filter((t) => t.enabled).length} enabled destinations`, href: '/app/receptionist/call-handling#transfers' },
    { label: 'Recovery SMS consent', state: draft.recovery.enabled && draft.recovery.consentMode === 'disabled' ? 'fail' : 'pass', detail: draft.recovery.enabled ? `On · ${draft.recovery.consentMode === 'existing' ? 'existing consent' : 'asks on call'}` : 'Off', href: '/app/receptionist/call-handling#recovery' },
  ]
  const blocking = checks.filter((c) => c.state === 'fail')
  const warnings = checks.filter((c) => c.state === 'warn')
  const canPublish = changes.length > 0 && blocking.length === 0 && status !== 'publishing'

  const run = async () => {
    const ok = await publish({ fail: simulateFail })
    if (ok) {
      toast.success('Published — new calls use this version')
      router.push('/app/receptionist')
    } else {
      toast.error('Publish failed to sync. Live calls still use the previous version.')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {status === 'sync_failed' && (
          <Callout tone="warning" icon={AlertCircle} title="Last publish didn't sync">
            Your previous live version is still answering calls. Retry, or discard the draft to stay on the current version.
          </Callout>
        )}
        <Panel title="What changes" description={changes.length ? `${changes.length} section${changes.length === 1 ? '' : 's'} differ from the live version` : 'Your draft matches what is live.'}>
          {changes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="size-8 text-success" aria-hidden />
              <p className="text-sm text-muted-foreground">Nothing to publish. Edit Agent settings, Appointments or Call handling to create a draft.</p>
              <Button variant="outline" size="sm" render={<Link href="/app/receptionist/agent" />}>Open Agent settings</Button>
            </div>
          ) : (
            <ul className="flex flex-col divide-y">
              {changes.map((c) => (
                <li key={c.key} className="flex items-center gap-3 py-3">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="flex-1 text-sm font-medium">{c.label}</span>
                  <Summary k={c.key} draft={draft} live={live} />
                  {EDIT_HREF[c.key] && <Link href={EDIT_HREF[c.key]!} className="flex items-center text-xs font-medium text-primary hover:underline">Edit<ChevronRight className="size-3" /></Link>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Pre-flight checks" description="Blocking issues must be fixed before publishing.">
          <ul className="flex flex-col divide-y">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5">
                {c.state === 'pass' ? <CheckCircle2 className="size-4 text-success" aria-label="Passed" /> : c.state === 'warn' ? <TriangleAlert className="size-4 text-warning" aria-label="Warning" /> : <AlertCircle className="size-4 text-destructive" aria-label="Blocking" />}
                <span className="w-40 shrink-0 text-sm font-medium">{c.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.detail}</span>
                {c.state !== 'pass' && c.href && <Link href={c.href} className="text-xs font-medium text-primary hover:underline">Fix</Link>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-xl surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Publish</span>
            <AgentStatusBadge />
          </div>
          <dl className="flex flex-col gap-2 text-xs">
            <Row k="Changes" v={String(changes.length)} />
            <Row k="Blocking" v={String(blocking.length)} tone={blocking.length ? 'text-destructive' : undefined} />
            <Row k="Warnings" v={String(warnings.length)} tone={warnings.length ? 'text-warning-foreground' : undefined} />
            <Row k="Last published" v={formatWhen(lastPublished)} />
          </dl>
          {unsaved && <p className="text-xs text-muted-foreground">Unsaved edits are included when you publish.</p>}
          <button type="button" onClick={() => setTested(true)} className={cn('flex items-center gap-2 rounded-lg p-2.5 text-left text-xs transition-colors', tested ? 'bg-success/10 text-success' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
            {tested ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
            {tested ? 'Draft tested' : 'Mark draft as tested'}
          </button>
          <Button variant="outline" render={<Link href="/app/receptionist/test" />}><FlaskConical data-icon="inline-start" />Test draft</Button>
          <Button disabled={!canPublish} onClick={run}>
            {status === 'publishing' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : status === 'sync_failed' ? <RefreshCw data-icon="inline-start" /> : <Rocket data-icon="inline-start" />}
            {status === 'publishing' ? 'Publishing…' : status === 'sync_failed' ? 'Retry publish' : 'Publish to live'}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Calls already in progress finish on the current version. New calls use the published version within seconds.</p>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" className="accent-[var(--primary)]" checked={simulateFail} onChange={(e) => setSimulateFail(e.target.checked)} />
            Demo: simulate sync failure
          </label>
        </section>
        <section className="flex flex-col gap-3 rounded-xl surface p-5">
          <span className="text-sm font-semibold">Answering calls</span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status === 'paused' ? 'Paused — calls follow your Phone routing without the agent. Missed calls may trigger MCTB.' : 'Pausing stops the agent immediately without changing your draft.'}
          </p>
          <Button variant="outline" onClick={() => { setPaused(status !== 'paused'); toast(status === 'paused' ? 'Agent resumed' : 'Agent paused') }}>
            {status === 'paused' ? <PlayCircle data-icon="inline-start" /> : <PauseCircle data-icon="inline-start" />}
            {status === 'paused' ? 'Resume agent' : 'Pause agent'}
          </Button>
        </section>
      </aside>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn('font-semibold tabular-nums', tone)}>{v}</dd>
    </div>
  )
}

function Summary({ k, draft, live }: { k: keyof AgentConfig; draft: AgentConfig; live: AgentConfig }) {
  let text = ''
  if (k === 'identity' && draft.identity.name !== live.identity.name) text = `${live.identity.name} → ${draft.identity.name}`
  else if (k === 'identity' && draft.identity.voice !== live.identity.voice) text = `Voice ${live.identity.voice} → ${draft.identity.voice}`
  else if (k === 'coverage') text = `${live.coverage.mode.replace('_', ' ')} → ${draft.coverage.mode.replace('_', ' ')}`
  else if (k === 'transfers') text = `${live.transfers.length} → ${draft.transfers.length} destinations`
  else if (k === 'capabilities') {
    const on = (Object.keys(draft.capabilities) as (keyof AgentConfig['capabilities'])[]).filter((c) => draft.capabilities[c] !== live.capabilities[c])
    text = `${on.length} toggled`
  } else if (k === 'recovery') text = draft.recovery.enabled !== live.recovery.enabled ? (draft.recovery.enabled ? 'Turned on' : 'Turned off') : 'Settings edited'
  else if (k === 'connection') text = 'New number'
  return text ? <StatusBadge tone="neutral" className="hidden sm:inline-flex">{text}</StatusBadge> : null
}
