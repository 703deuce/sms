import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { IntegrationsCatalog } from '@/components/integrations/integrations-catalog'

export const metadata = { title: 'Integrations' }

export default function IntegrationsPage() {
  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Connect calendars, CRMs and payment providers. Credentials are stored encrypted and never shown here."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading integrations…</p>}>
        <IntegrationsCatalog />
      </Suspense>
    </Page>
  )
}
