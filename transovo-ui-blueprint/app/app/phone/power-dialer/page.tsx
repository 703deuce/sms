import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialer } from '@/components/phone/power-dialer'

export const metadata = { title: 'Power Dialer · Phone' }

export default async function PowerDialerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return (
    <Page>
      <PageHeader title="Power Dialer" description="Work through call lists one contact at a time with dispositions and attempt limits." />
      <PowerDialer initialTab={tab} />
    </Page>
  )
}
