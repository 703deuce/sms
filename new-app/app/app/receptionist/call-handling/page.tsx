import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallHandlingEditor } from '@/components/receptionist/call-handling'
import { DraftBar } from '@/components/receptionist/ai-ui'

export const metadata = { title: 'Call Handling · AI Receptionist' }

export default function AiCallHandling() {
  return (
    <Page>
      <DraftBar />
      <PageHeader
        title="Call handling"
        description="Coverage, transfers, callbacks, recovery and protection. Coverage edits the same routing policy shown in Phone and Numbers."
      />
      <Suspense>
        <CallHandlingEditor />
      </Suspense>
    </Page>
  )
}
