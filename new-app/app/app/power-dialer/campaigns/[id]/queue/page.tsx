import { CampaignQueueContent } from '@/components/power-dialer/campaign-queue-content'

export default async function CampaignQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CampaignQueueContent campaignId={id} />
}
