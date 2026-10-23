import { Page } from '@/components/app/page-primitives'
import { CampaignHistoryContent } from '@/components/power-dialer/campaign-history-content'

export const metadata = { title: 'Campaign history · Power Dialer' }

export default async function CampaignHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Page>
      <CampaignHistoryContent campaignId={id} />
    </Page>
  )
}
