import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ConversationalRoutingEditor } from '@/components/receptionist/conversational-routing-editor'
import { DraftBar } from '@/components/receptionist/ai-ui'

export const metadata = { title: 'Call Routing · Conversational IVR' }

export default function ConversationalCallRoutingPage() {
  return (
    <Page>
      <DraftBar />
      <PageHeader
        title="Call Routing"
        description="Tell your conversational menu when to connect callers and who should receive the call."
      />
      <Suspense>
        <ConversationalRoutingEditor />
      </Suspense>
    </Page>
  )
}
