import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { PowerDialer } from '@/components/phone/power-dialer'

export const metadata = { title: 'Dialer · Power Dialer' }

export default async function PowerDialerDialerPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; session?: string; contact?: string }>
}) {
  const sp = await searchParams
  return (
    <Page>
      <PageHeader
        title="Dialer"
        description="Run a sequential power-dialing session — select a campaign, dial, disposition, and move to the next contact."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading dialer…</p>}>
        <PowerDialer
          initialTab="session"
          initialCampaignId={sp.campaign}
          initialFocusContactId={sp.contact}
        />
      </Suspense>
    </Page>
  )
}
