import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { PowerDialerCallHistorySubnav } from '@/components/power-dialer/call-history-subnav'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { formatDuration, formatWhen } from '@/lib/format'

export const metadata = { title: 'Session history · Power Dialer' }
export const dynamic = 'force-dynamic'

function dialModeFromCampaign(campaign: { dialingMode: string } | null) {
  return campaign?.dialingMode || '—'
}

export default async function PowerDialerSessionHistoryPage() {
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const sessions = await prisma.powerDialerSession.findMany({
    where: { workspaceId },
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: {
      campaign: { select: { name: true, dialingMode: true } },
      attempts: { select: { id: true, contactId: true, status: true, disposition: true } },
    },
  })

  return (
    <Page>
      <PageHeader
        title="Session history"
        description="Power-dialer sessions with rep, campaign, dial mode, and outcomes."
        actions={
          <Link href="/app/power-dialer/call-history" className="text-sm text-primary hover:underline">
            ← Call attempts
          </Link>
        }
      />
      <PowerDialerCallHistorySubnav />
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Started</TableHead>
              <TableHead scope="col">Rep</TableHead>
              <TableHead scope="col">Campaign</TableHead>
              <TableHead scope="col">Dial mode</TableHead>
              <TableHead scope="col">Contacts processed</TableHead>
              <TableHead scope="col">Calls completed</TableHead>
              <TableHead scope="col">Duration</TableHead>
              <TableHead scope="col">Final status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => {
              const contactIds = new Set(s.attempts.map((a) => a.contactId))
              const completed = s.attempts.filter((a) => a.disposition || a.status === 'completed' || a.status === 'answered').length
              const durationSec =
                s.endedAt && s.startedAt
                  ? Math.max(0, Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000))
                  : null
              return (
                <TableRow key={s.id}>
                  <TableCell>{formatWhen(s.startedAt.toISOString())}</TableCell>
                  <TableCell className="font-mono text-xs">{s.repUserId?.slice(0, 8) || '—'}</TableCell>
                  <TableCell>{s.campaign.name}</TableCell>
                  <TableCell>{dialModeFromCampaign(s.campaign)}</TableCell>
                  <TableCell className="tabular-nums">{contactIds.size}</TableCell>
                  <TableCell className="tabular-nums">{completed}</TableCell>
                  <TableCell>{durationSec != null ? formatDuration(durationSec) : '—'}</TableCell>
                  <TableCell>{s.status}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>
    </Page>
  )
}
