import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { CampaignContactsContent } from '@/components/power-dialer/campaign-contacts-content'

export const metadata = { title: 'Campaign contacts · Power Dialer' }

export default async function CampaignContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Page>
      <PageHeader
        title="Campaign contacts"
        description="Per-contact eligibility and outcomes for this campaign."
        actions={<Link href="/app/power-dialer/campaigns" className="text-sm text-primary hover:underline">← Campaigns</Link>}
      />
      <CampaignContactsContent campaignId={id} />
    </Page>
  )
}
