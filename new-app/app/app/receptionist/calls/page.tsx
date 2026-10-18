import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallsTable } from '@/components/calls/calls-table'

export const metadata = { title: 'Calls · AI Receptionist' }

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  return (
    <Page>
      <PageHeader
        title="AI calls"
        description="Calls answered by Ava, with intent, outcome and follow-up status. Open a call for the summary, transcript and every action the agent took."
      />
      <CallsTable variant="receptionist" basePath="/app/receptionist/calls" initialFilter={filter} />
    </Page>
  )
}
