import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialer } from '@/components/phone/power-dialer'

export const metadata = { title: 'Calling Lists · Power Dialer' }

export default function PowerDialerListsPage() {
  return (
    <Page>
      <PageHeader title="Calling lists" description="Import and maintain contact lists used by campaigns." />
      <PowerDialer initialTab="lists" />
    </Page>
  )
}
