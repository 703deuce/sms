import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallsTable } from '@/components/calls/calls-table'

export const metadata = { title: 'Missed calls · Missed Call Text Back' }

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  return (
    <Page>
      <PageHeader
        title="Missed calls"
        description="Each missed call, whether the caller consented to a text, what was sent, and whether they replied. A sent text alone never counts as a recovered call."
      />
      <CallsTable variant="mctb" basePath="/app/mctb/calls" initialFilter={filter} />
    </Page>
  )
}
