import Link from 'next/link'
import { MessageSquareText, Settings2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { requireSession } from '@/lib/api-auth'
import { formatPhone, formatWhen } from '@/lib/format'
import { loadMctbOverviewForNewApp } from '@/lib/server/mctb/overview-load'

export const metadata = { title: 'Missed Call Text Back' }

export default async function McTbOverview() {
  const { workspaceId } = await requireSession()
  const data = await loadMctbOverviewForNewApp(workspaceId)

  return (
    <Page>
      <PageHeader
        eyebrow={
          <StatusBadge tone={data.masterEnabled ? 'success' : 'warning'}>
            {data.masterEnabled ? `Recovery on · ${data.activeLines} line(s)` : 'Recovery paused or setup incomplete'}
          </StatusBadge>
        }
        title="Missed Call Text Back"
        description="When nobody picks up, eligible callers can consent and receive a recovery text so the conversation continues in your inbox."
        actions={
          <>
            <Link href="/app/mctb/setup" className={buttonVariants({ variant: 'outline' })}>
              <Settings2 />
              Setup
            </Link>
            <Link href="/app/mctb/conversations" className={buttonVariants()}>
              <MessageSquareText />
              Conversations
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Missed today" value={data.missedToday} href="/app/mctb/calls" />
        <Stat label="Texts sent today" value={data.textsSentToday} href="/app/mctb/calls?filter=texted" />
        <Stat label="Needs reply" value={data.needsReply} tone={data.needsReply ? 'warning' : undefined} href="/app/mctb/conversations" />
        <Stat label="Consent mode" value={data.consentMode.replace(/_/g, ' ')} />
      </div>
      <Panel title="Recent missed calls">
        {data.recentMissed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missed calls yet.</p>
        ) : (
          <ul className="divide-y">
            {data.recentMissed.map((row) => (
              <li key={row.id}>
                <Link href={`/app/mctb/calls/${row.id}`} className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 hover:bg-muted/50">
                  <span className="font-mono text-sm">{formatPhone(row.callerE164)}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(row.detectedAt)}</span>
                  <StatusBadge tone={row.smsSentAt ? 'success' : 'muted'}>{row.status}</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  )
}
