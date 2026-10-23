import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialer } from '@/components/phone/power-dialer'

export const metadata = { title: 'Dialer · Power Dialer' }

export default function PowerDialerDialerPage() {
  return (
    <Page>
      <PageHeader
        title="Dialer"
        description="Run a sequential power-dialing session — select a campaign, dial, disposition, and move to the next contact."
      />
      <PowerDialer initialTab="session" />
    </Page>
  )
}
