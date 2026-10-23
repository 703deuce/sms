import { Suspense } from 'react'
import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { IntegrationsCatalog } from '@/components/integrations/integrations-catalog'

export const metadata = { title: 'Integrations · Power Dialer' }

export default function PowerDialerIntegrationsPage() {
  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Connect CRMs and automation providers. Power-dialer list import and call writeback wiring continues in Phase 6."
      />
      <Panel title="Workspace integrations" description="Same connections as global Integrations — shared OAuth and credentials.">
        <p className="mb-4 text-sm text-muted-foreground">
          Manage connections globally at{' '}
          <Link href="/app/integrations" className="text-primary hover:underline">Integrations</Link>.
        </p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading integrations…</p>}>
          <IntegrationsCatalog />
        </Suspense>
      </Panel>
    </Page>
  )
}
