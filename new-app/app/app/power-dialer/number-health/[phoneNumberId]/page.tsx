'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { formatPhone } from '@/lib/format'
import type { NumberHealthRow } from '@/components/power-dialer/number-health-content'

type Detail = {
  e164: string
  nickname: string | null
  registrationStatus: string
  health: NumberHealthRow | null
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

  const h = detail.health

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
      {h && (
        <Panel title="Health assessment (based on your call data)">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={h.healthLabel === 'healthy' ? 'success' : h.healthLabel === 'at_risk' ? 'danger' : 'warning'}>
              {h.healthLabel}
            </StatusBadge>
            {h.healthSuggestion && <span className="text-sm text-muted-foreground">{h.healthSuggestion}</span>}
          </div>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
            {h.healthReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">7d answer rate</dt><dd className="font-medium">{h.metrics7d.answerRatePct ?? '—'}%</dd></div>
            <div><dt className="text-muted-foreground">30d answer rate</dt><dd className="font-medium">{h.metrics30d?.answerRatePct ?? h.answerRate ?? '—'}%</dd></div>
            <div><dt className="text-muted-foreground">Complaint-style dispositions (30d)</dt><dd className="font-medium">{h.metrics30d?.spamFlagCount ?? 0}</dd></div>
          </dl>
        </Panel>
      )}
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
