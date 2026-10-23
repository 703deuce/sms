'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { fetchPowerDialerOverview, type PowerDialerOverviewDto } from '@/lib/phone-api'
import { formatDuration, formatPhone, formatWhen } from '@/lib/format'

export function PowerDialerOverviewContent() {
  const { webrtcStatus } = useWorkspace()
  const [data, setData] = useState<PowerDialerOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPowerDialerOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load overview'))
  }, [])

  const kpis = data?.kpis

  const attention = useMemo(() => {
    const items = [...(data?.attentionRequired ?? [])]
    if (webrtcStatus !== 'ready') {
      items.push({
        code: 'mic_unavailable',
        message: 'Browser calling is not ready — check microphone permissions before dialing.',
      })
    }
    return items
  }, [data?.attentionRequired, webrtcStatus])

  return (
    <Page>
      <PageHeader
        title="Overview"
        description="Campaign readiness, today’s dialing activity, and where to go next."
        actions={
          <Link
            href={
              data?.activeSession
                ? `/app/power-dialer/dialer?session=${data.activeSession.id}`
                : '/app/power-dialer/dialer'
            }
            className={buttonVariants()}
          >
            <Play />
            Start dialing
          </Link>
        }
      />
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {attention.length > 0 && (
        <section aria-label="Attention required" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">Attention required</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {attention.map((a) => (
              <li key={a.code}>{a.message}</li>
            ))}
          </ul>
        </section>
      )}
      {kpis && (
        <section aria-label="Today" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Attempts today" value={kpis.attemptsToday} />
          <Stat label="Human conversations" value={kpis.humanConversations} tone="success" />
          <Stat label="Answer rate" value={`${kpis.answerRate}%`} hint="Outbound power-dialer calls with answer time" />
          <Stat label="Talk time" value={formatDuration(kpis.talkSec)} />
        </section>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Setup checklist" description="Resolve blockers before high-volume dialing.">
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span>Calling lists</span>
              <StatusBadge tone={(data?.listCount ?? 0) > 0 ? 'success' : 'warning'}>
                {(data?.listCount ?? 0) > 0 ? `${data?.listCount} list(s)` : 'Create a list'}
              </StatusBadge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Active campaigns</span>
              <StatusBadge tone={(data?.campaigns.length ?? 0) > 0 ? 'success' : 'warning'}>
                {data?.campaigns.length ? `${data.campaigns.length} recent` : 'None yet'}
              </StatusBadge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Callbacks due</span>
              <Link href="/app/power-dialer/callbacks?tab=due_today" className="text-primary hover:underline">
                {kpis?.callbacksDue ?? 0} scheduled
              </Link>
            </li>
          </ul>
        </Panel>
        <Panel title="Campaigns" bodyClassName="p-0">
          <ul className="divide-y text-sm">
            {(data?.campaigns ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-muted-foreground">
                No campaigns yet.{' '}
                <Link href="/app/power-dialer/campaigns" className="text-primary hover:underline">Create one</Link>
              </li>
            )}
            {data?.campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link href={`/app/power-dialer/campaigns/${c.id}/queue`} className="font-medium hover:text-primary">
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground tabular">{c.completedPct}% · {c.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Recent activity" bodyClassName="p-0">
        <ul className="divide-y text-sm">
          {(data?.recentActivity ?? []).length === 0 && (
            <li className="px-5 py-8 text-center text-muted-foreground">No dialer attempts recorded yet.</li>
          )}
          {data?.recentActivity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span>
                <span className="font-medium">{a.contactName}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="font-mono text-xs text-muted-foreground">{formatPhone(a.contactPhone)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {a.disposition || a.status} · {formatWhen(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  )
}
