'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Panel, Stat } from '@/components/app/page-primitives'
import { CampaignSubnav } from '@/components/power-dialer/campaign-subnav'
import { fetchCampaignAnalytics, type CampaignAnalyticsDto } from '@/lib/phone-api'
import { formatDuration } from '@/lib/format'

export function CampaignAnalyticsContent({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignAnalyticsDto | null>(null)

  useEffect(() => {
    void fetchCampaignAnalytics(campaignId)
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load analytics'))
  }, [campaignId])

  return (
    <>
      <Link href="/app/power-dialer/campaigns" className="text-sm text-primary hover:underline">← Campaigns</Link>
      <CampaignSubnav campaignId={campaignId} />
      {data && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Attempts" value={data.totalAttempts} />
          <Stat label="Unique contacts" value={data.uniqueContacts} />
          <Stat label="Human conversations" value={data.humanConversations} tone="success" />
          <Stat label="Talk time" value={formatDuration(data.talkSec)} />
          <Stat label="Human rate" value={`${data.answerRate}%`} />
        </section>
      )}
      {data && Object.keys(data.dispositions).length > 0 && (
        <Panel title="Dispositions" className="mt-6">
          <ul className="text-sm">
            {Object.entries(data.dispositions).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b py-2">
                <span>{k}</span>
                <span className="tabular-nums text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
