import { Page, PageHeader } from '@/components/app/page-primitives'
import { TestConsole } from '@/components/receptionist/test-console'

export const metadata = { title: 'Test · AI Receptionist' }

export default function TestPage() {
  return (
    <Page>
      <PageHeader eyebrow="AI Receptionist" title="Test your agent" description="Run a simulated call against the draft or live version, or have the agent call your phone." />
      <TestConsole />
    </Page>
  )
}
