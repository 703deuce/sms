import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { formatWhen } from '@/lib/format'

export const metadata = { title: 'Session history · Power Dialer' }
export const dynamic = 'force-dynamic'

export default async function PowerDialerSessionHistoryPage() {
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const sessions = await prisma.powerDialerSession.findMany({
    where: { workspaceId },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { campaign: { select: { name: true } }, attempts: { select: { id: true } } },
  })

  return (
    <Page>
      <PageHeader
        title="Session history"
        description="Power-dialer sessions grouped separately from individual call attempts."
        actions={
          <Link href="/app/power-dialer/call-history" className="text-sm text-primary hover:underline">
            ← Call attempts
          </Link>
        }
      />
      <Panel bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2" scope="col">Started</th>
              <th className="px-4 py-2" scope="col">Campaign</th>
              <th className="px-4 py-2" scope="col">Status</th>
              <th className="px-4 py-2" scope="col">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="px-4 py-3">{formatWhen(s.startedAt.toISOString())}</td>
                <td className="px-4 py-3">{s.campaign.name}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 tabular-nums">{s.attempts.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  )
}
