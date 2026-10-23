import { Page, PageHeader } from '@/components/app/page-primitives'
import { CampaignsWorkspace } from '@/components/power-dialer/campaigns-workspace'

export const metadata = { title: 'Campaigns · Power Dialer' }

export default function PowerDialerCampaignsPage() {
  return (
    <Page>
      <PageHeader title="Campaigns" description="Create and manage power-dialer campaigns tied to calling lists." />
      <CampaignsWorkspace />
    </Page>
  )
}
