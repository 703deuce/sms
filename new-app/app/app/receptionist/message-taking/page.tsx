import { Page, PageHeader } from '@/components/app/page-primitives'
import { MessageTakingEditor } from '@/components/receptionist/message-taking-editor'
import { DraftBar } from '@/components/receptionist/ai-ui'

export const metadata = { title: 'Message Taking · Conversational IVR' }

export default function MessageTakingPage() {
  return (
    <Page>
      <DraftBar />
      <PageHeader
        title="Message Taking"
        description="Choose what your conversational menu should ask when callers want to leave a message."
      />
      <MessageTakingEditor />
    </Page>
  )
}
