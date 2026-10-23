import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialer } from '@/components/phone/power-dialer'

export const metadata = { title: 'Campaigns · Power Dialer' }

export default function PowerDialerCampaignsPage() {
  return (
    <Page>
      <PageHeader title="Campaigns" description="Create and manage power-dialer campaigns tied to calling lists." />
      <PowerDialer initialTab="campaigns" />
    </Page>
  )
}
