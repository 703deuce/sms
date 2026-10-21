'use client'

import { Page, PageHeader } from '@/components/app/page-primitives'
import { DraftBar } from '@/components/receptionist/ai-ui'
import { CallerIntakePageContent } from '@/components/receptionist/caller-intake-page-content'
import { useAgent } from '@/components/providers/agent-provider'
import { isConversationalIvrEditor } from '@/lib/receptionist/runtime-profile'

export default function MessageTakingPage() {
  const { draft } = useAgent()
  const ivr = isConversationalIvrEditor(draft)

  return (
    <Page>
      <DraftBar />
      <PageHeader
        title={ivr ? 'Message Taking' : 'Caller Intake'}
        description={
          ivr
            ? 'Choose what your conversational menu should ask when callers want to leave a message.'
            : 'Messages, callback requests, intake fields, and qualification for Full Receptionist.'
        }
      />
      <CallerIntakePageContent />
    </Page>
  )
}
