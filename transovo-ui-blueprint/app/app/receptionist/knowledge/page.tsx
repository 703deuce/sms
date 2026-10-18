import { Page, PageHeader } from '@/components/app/page-primitives'
import { KnowledgeManager } from '@/components/receptionist/knowledge-manager'

export const metadata = { title: 'Knowledge · AI Receptionist' }

export default function KnowledgePage() {
  return (
    <Page>
      <PageHeader title="Knowledge" description="Ava answers only from approved FAQs and processed sources. Close gaps to reduce unresolved calls." />
      <KnowledgeManager />
    </Page>
  )
}
