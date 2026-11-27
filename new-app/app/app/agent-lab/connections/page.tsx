import { Plug } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { AgentLabConnections } from '@/components/agent-lab/agent-lab-connections'

export const metadata = { title: 'Connections' }

export default function AgentLabConnectionsPage() {
  return (
    <Page>
      <PageHeader
        icon={Plug}
        title="Connections"
        description="Tell the agent to use any of these apps and it'll send you a secure link to connect."
        breadcrumbs={[
          { label: 'Agent Lab', href: '/app/agent-lab' },
          { label: 'Connections' },
        ]}
      />
      <AgentLabConnections />
    </Page>
  )
}
