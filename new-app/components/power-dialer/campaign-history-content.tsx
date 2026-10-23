'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/app/page-primitives'
import { CampaignSubnav } from '@/components/power-dialer/campaign-subnav'
import { fetchCampaignHistory, type CampaignHistorySession } from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'

export function CampaignHistoryContent({ campaignId }: { campaignId: string }) {
  const [sessions, setSessions] = useState<CampaignHistorySession[]>([])

  useEffect(() => {
    void fetchCampaignHistory(campaignId)
      .then(setSessions)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load history'))
  }, [campaignId])

  return (
    <>
      <Link href="/app/power-dialer/campaigns" className="text-sm text-primary hover:underline">← Campaigns</Link>
      <CampaignSubnav campaignId={campaignId} />
      <Panel title="Session history" description="Dialing sessions and recent attempts for this campaign.">
        <ul className="divide-y text-sm">
          {sessions.length === 0 && (
            <li className="py-8 text-center text-muted-foreground">No sessions yet.</li>
          )}
          {sessions.map((s) => (
            <li key={s.id} className="py-4">
              <p className="font-medium">
                Session {formatWhen(s.startedAt)} · {s.status}
                {s.endedAt ? ` · ended ${formatWhen(s.endedAt)}` : ''}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {s.attempts.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    {a.contactName} · {formatPhone(a.contactPhone)} · {a.disposition || a.status} · {formatWhen(a.createdAt)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
