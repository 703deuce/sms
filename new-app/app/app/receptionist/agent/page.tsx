import { Page, PageHeader } from '@/components/app/page-primitives'
import { AgentEditor } from '@/components/receptionist/agent-editor'
import { DraftBar } from '@/components/receptionist/ai-ui'

export const metadata = { title: 'Agent Settings · AI Receptionist' }

export default function AgentPage() {
  return (
    <Page>
      <DraftBar />
      <PageHeader title="Agent settings" description="Identity, voice, greeting, capabilities and intake. Edits stay in your draft until you publish." />
      <AgentEditor />
    </Page>
  )
}
