import { Page, PageHeader } from '@/components/app/page-primitives'
import { Dialer } from '@/components/phone/dialer'

export const metadata = { title: 'Dialer · Phone' }

export default async function DialerPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams
  return (
    <Page>
      <PageHeader title="Dialer" description="Place a call from any of your lines. Calls stay connected while you move around the app." />
      <Dialer initialTo={to} />
    </Page>
  )
}
