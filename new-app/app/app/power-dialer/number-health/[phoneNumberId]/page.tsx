'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { formatPhone } from '@/lib/format'

type Detail = {
  e164: string
  nickname: string | null
  registrationStatus: string
  trend: { month: string; attempts: number; answered: number; human: number; screened: number }[]
  recentOutcomes: {
    callId: string
    at: string
    status: string
    disposition: string | null
    answerClassification: string | null
  }[]
}

export default function PowerDialerNumberDetailPage() {
  const params = useParams()
  const phoneNumberId = String(params.phoneNumberId || '')
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    if (!phoneNumberId) return
    void fetch(`/api/phone/power-dialer/number-health/${phoneNumberId}`)
      .then((r) => r.json())
      .then((j) => setDetail(j.data))
  }, [phoneNumberId])

  if (!detail) {
    return (
      <Page>
        <PageHeader title="Number details" description="Loading…" />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title={detail.nickname || 'Outbound number'}
        description={`${formatPhone(detail.e164)} · Registration: ${detail.registrationStatus}`}
        breadcrumbs={[
          { label: 'Number health', href: '/app/power-dialer/number-health' },
          { label: formatPhone(detail.e164) },
        ]}
      />
      <Panel title="Volume trend (monthly)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 font-medium">Month</th>
              <th scope="col" className="py-2 font-medium">Attempts</th>
              <th scope="col" className="py-2 font-medium">Answered</th>
              <th scope="col" className="py-2 font-medium">Human conv.</th>
              <th scope="col" className="py-2 font-medium">Screened</th>
            </tr>
          </thead>
          <tbody>
            {detail.trend.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">No history yet.</td>
              </tr>
            )}
            {detail.trend.map((t) => (
              <tr key={t.month} className="border-b">
                <td className="py-2">{t.month}</td>
                <td className="py-2">{t.attempts}</td>
                <td className="py-2">{t.answered}</td>
                <td className="py-2">{t.human}</td>
                <td className="py-2">{t.screened}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Recent outcomes">
        <ul className="divide-y text-sm">
          {detail.recentOutcomes.map((o) => (
            <li key={o.callId} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/app/power-dialer/call-history/${o.callId}`} className="text-primary hover:underline">
                {new Date(o.at).toLocaleString()}
              </Link>
              <span className="text-muted-foreground">
                {o.answerClassification || '—'} · {o.disposition || o.status}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-xs text-muted-foreground">
        <Link href="/app/power-dialer/number-health" className="text-primary hover:underline">Back to number health</Link>
      </p>
    </Page>
  )
}
