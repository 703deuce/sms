import type { Metadata } from 'next'
import { Page, PageHeader, Stat } from '@/components/app/kit'
import { CallsBrowser } from '@/components/voice/calls-browser'

export const metadata: Metadata = { title: 'Calls' }

export default function CallsPage() {
  return (
    <Page>
      <PageHeader title="Calls" description="Track and manage calls handled by the AI receptionist." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Answered" value="289" delta={11} />
        <Stat label="Leads" value="41" delta={6} />
        <Stat label="Appointments" value="70" delta={8} />
        <Stat label="Talk time" value="14h 22m" delta={3} />
      </div>
      <CallsBrowser />
    </Page>
  )
}
