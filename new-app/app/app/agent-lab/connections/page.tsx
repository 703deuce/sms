import { Plug } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { AgentLabConnections } from '@/components/agent-lab/agent-lab-connections'

export const metadata = { title: 'Connections' }

export default function AgentLabConnectionsPage() {
  return (
    <Page fluid>
      <PageHeader
        icon={Plug}
        title="Connections"
        description="Connect an app here and the agent can use it in chat. One-click apps open a sign-in tab; API-key apps ask for the key on this page."
        breadcrumbs={[
          { label: 'Agent Lab', href: '/app/agent-lab' },
          { label: 'Connections' },
        ]}
      />
      <AgentLabConnections />
    </Page>
  )
}
