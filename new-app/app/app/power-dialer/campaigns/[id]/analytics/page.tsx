import { Page } from '@/components/app/page-primitives'
import { CampaignAnalyticsContent } from '@/components/power-dialer/campaign-analytics-content'

export const metadata = { title: 'Campaign analytics · Power Dialer' }

export default async function CampaignAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Page>
      <CampaignAnalyticsContent campaignId={id} />
    </Page>
  )
}
