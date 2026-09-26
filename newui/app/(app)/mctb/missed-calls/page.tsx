import type { Metadata } from 'next'
import { Page, PageHeader, Stat } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { MissedCallsBrowser } from '@/components/mctb/missed-calls-browser'

export const metadata: Metadata = { title: 'Missed Calls' }

export default function MissedCallsPage() {
  return (
    <Page>
      <PageHeader
        title="Missed Calls"
        description="Every call your team couldn't answer, and what happened next."
        actions={<ButtonLink href="/mctb/setup" variant="outline">Manage setup</ButtonLink>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value="87" delta={-6} />
        <Stat label="Recovery texts" value="81" delta={9} />
        <Stat label="Replies" value="52" delta={14} />
        <Stat label="Needs reply" value="4" href="/mctb/conversations?filter=needs_reply" />
      </div>
      <MissedCallsBrowser />
    </Page>
  )
}
