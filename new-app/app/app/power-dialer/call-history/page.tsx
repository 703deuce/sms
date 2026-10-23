import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialerCallHistoryContent } from '@/components/power-dialer/call-history-content'

export const metadata = { title: 'Call History · Power Dialer' }

export default async function PowerDialerCallHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  return (
    <Page>
      <PageHeader
        title="Call history"
        description="Outbound power-dialer calls with disposition, duration, and recordings when available."
      />
      <PowerDialerCallHistoryContent initialFilter={filter} />
    </Page>
  )
}
