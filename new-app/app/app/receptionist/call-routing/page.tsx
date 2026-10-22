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
        description="Connect the line callers dial to reach your agent, then configure transfer destinations — name, number, description, and when the AI should transfer."
      />
      <Suspense>
        <ConversationalRoutingEditor />
      </Suspense>
    </Page>
  )
}
