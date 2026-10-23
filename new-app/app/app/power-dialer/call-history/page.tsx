import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallsTable } from '@/components/calls/calls-table'

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
        description="Outbound power-dialer calls recorded on HumanCall rows, including recordings when available."
      />
      <CallsTable variant="power_dialer" basePath="/app/power-dialer/call-history" initialFilter={filter} />
    </Page>
  )
}
