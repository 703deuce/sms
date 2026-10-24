import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, Funnel } from '@/components/app/charts'
import { requireSession } from '@/lib/api-auth'
import { loadMctbAnalytics } from '@/lib/mctb/analytics'

export const metadata = { title: 'Analytics · Missed Call Text Back' }

export default async function McTbAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { workspaceId } = await requireSession()
  const { range: raw } = await searchParams
  const range = raw === '7d' || raw === '90d' ? raw : '30d'
  const data = await loadMctbAnalytics(workspaceId, range)

  const funnel = [
    { stage: 'Missed calls', value: data.totalMissed },
    { stage: 'Eligible', value: data.eligible },
    { stage: 'Texts sent', value: data.textsSent },
    { stage: 'Replied', value: data.replies },
  ]

  const reasons = Object.entries(data.suppressionByReason || {}).map(([reason, count]) => ({
    reason: reason.replace(/_/g, ' '),
    count,
  }))

  return (
    <Page>
      <PageHeader
        title="Missed Call Text Back analytics"
        description="Authoritative counts from missed-call events in your workspace timezone."
      />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Missed calls" value={data.totalMissed} />
        <Stat label="Texts sent" value={data.textsSent} />
        <Stat label="Reply rate" value={`${data.replyRate}%`} hint="Of delivered texts" />
        <Stat label="Suppressed" value={data.suppressed} />
      </section>
      <Panel title="Recovery funnel">
        <Funnel stages={funnel} />
      </Panel>
      {reasons.length > 0 && (
        <Panel title="Why texts were not sent">
          <BarsChart horizontal data={reasons} xKey="reason" config={{ count: { label: 'Calls', color: 'var(--chart-4)' } }} />
        </Panel>
      )}
    </Page>
  )
}
