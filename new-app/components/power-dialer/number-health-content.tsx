'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { formatPhone } from '@/lib/format'

export type NumberHealthRow = {
  phoneNumberId: string
  e164: string
  nickname: string | null
  attempts: number
  minutes: number
  answerRate: number | null
  humanConversationRate: number | null
  screeningRate: number | null
  failedCalls: number
  registrationStatus: string
}

export function PowerDialerNumberHealthContent() {
  const [rows, setRows] = useState<NumberHealthRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/phone/power-dialer/number-health')
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => setError('Could not load number health metrics'))
  }, [])

  return (
    <Page>
      <PageHeader
        title="Number health"
        description="Transovo performance metrics for numbers used on power-dialer outbound calls. Official carrier reputation scores are not shown unless sourced from Telnyx Number Reputation (premium)."
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/app/power-dialer/number-health/free-tools" className="text-primary hover:underline">
              Free reputation tools
            </Link>
            <Link href="/app/power-dialer/number-health/premium" className="text-primary hover:underline">
              Premium reputation
            </Link>
            <Link href="/app/numbers" className="text-primary hover:underline">
              Numbers inventory
            </Link>
          </div>
        }
      />
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Panel title="Transovo performance metrics" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Attempts</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Minutes</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Answer rate</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Human conv.</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Screening</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Failed</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Registration</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-muted-foreground">
                  No power-dialer outbound usage on assigned numbers yet.
                </td>
              </tr>
            )}
            {rows.map((n) => (
              <tr key={n.phoneNumberId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{n.nickname || 'Line'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{formatPhone(n.e164)}</span>
                </td>
                <td className="px-4 py-3">{n.attempts}</td>
                <td className="px-4 py-3">{n.minutes.toFixed(1)}</td>
                <td className="px-4 py-3">{n.answerRate != null ? `${n.answerRate}%` : '—'}</td>
                <td className="px-4 py-3">{n.humanConversationRate != null ? `${n.humanConversationRate}%` : '—'}</td>
                <td className="px-4 py-3">{n.screeningRate != null ? `${n.screeningRate}%` : '—'}</td>
                <td className="px-4 py-3">{n.failedCalls}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="neutral">{n.registrationStatus}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/app/power-dialer/number-health/${n.phoneNumberId}`}
                    className="text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p className="text-xs text-muted-foreground">
        Human conversation excludes screener, voicemail, and IVR classifications. Screening rate uses Telnyx premium/screener detection when events are received.
      </p>
    </Page>
  )
}
