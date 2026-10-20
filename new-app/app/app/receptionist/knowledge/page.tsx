import { Page, PageHeader } from '@/components/app/page-primitives'
import { KnowledgeManager } from '@/components/receptionist/knowledge-manager'

export const metadata = { title: 'Business Knowledge · Conversational IVR' }

export default function KnowledgePage() {
  return (
    <Page>
      <PageHeader
        title="Business Knowledge"
        description="Give your conversational menu the information it needs to answer callers accurately."
      />
      <KnowledgeManager />
    </Page>
  )
}
