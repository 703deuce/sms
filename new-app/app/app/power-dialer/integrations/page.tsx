import { Suspense } from 'react'
import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { PowerDialerIntegrationsList } from '@/components/power-dialer/integrations-list'

export const metadata = { title: 'Integrations · Power Dialer' }

export default function PowerDialerIntegrationsPage() {
  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Salesforce, Zoho, and Pipedrive reuse workspace OAuth. Supported operations reflect each provider’s real API capabilities."
        actions={
          <Link href="/app/power-dialer/integrations/sync-history" className="text-sm text-primary hover:underline">
            Sync history
          </Link>
        }
      />
      <PowerDialerIntegrationsList />
    </Page>
  )
}
