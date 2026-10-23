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
  dialsToday: number
  minutes: number
  answerRate: number | null
  humanConversationRate: number | null
  screeningRate: number | null
  failedCalls: number
  registrationStatus: string
  telnyxReputationStatus: string
  stirShakenAttestation: string
  healthLabel: 'healthy' | 'watch' | 'at_risk'
  healthLabelSource: 'based_on_your_call_data'
  healthReasons: string[]
  healthSuggestion: string | null
  metrics7d: { shortCallRatePct: number | null; voicemailNoAnswerRatePct: number | null; spamFlagCount: number; answerRatePct: number | null }
  metrics30d: { answerRatePct: number | null; spamFlagCount: number }
  trendAnswerRate7vs30: number | null
}

function healthTone(label: string) {
  if (label === 'healthy') return 'success'
  if (label === 'at_risk') return 'danger'
  return 'warning'
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
        description="Labels are based on your call data (answer rate, short calls, voicemail/no-answer, complaint-style dispositions) — not carrier spam scores unless you enable premium Telnyx reputation."
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
      <Panel title="Outbound number performance" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Attempts (30d)</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Today</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Health</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Answer rate</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Short calls</th>
              <th scope="col" className="px-4 py-2.5 font-medium">VM / no answer</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Flags</th>
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
              <tr key={n.phoneNumberId} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">
                  <span className="font-medium">{n.nickname || 'Line'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{formatPhone(n.e164)}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{n.attempts}</td>
                <td className="px-4 py-3 tabular-nums">{n.dialsToday ?? 0}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={healthTone(n.healthLabel)}>{n.healthLabel}</StatusBadge>
                  <span className="mt-1 block text-xs text-muted-foreground">Based on your call data</span>
                  {n.healthSuggestion && (
                    <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">{n.healthSuggestion}</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {n.answerRate != null ? `${n.answerRate}%` : '—'}
                  {n.trendAnswerRate7vs30 != null && (
                    <span className="block text-xs text-muted-foreground">
                      7d vs 30d: {n.trendAnswerRate7vs30 > 0 ? '+' : ''}{n.trendAnswerRate7vs30} pts
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {n.metrics7d?.shortCallRatePct != null ? `${n.metrics7d.shortCallRatePct}%` : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {n.metrics7d?.voicemailNoAnswerRatePct != null ? `${n.metrics7d.voicemailNoAnswerRatePct}%` : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums">{n.metrics7d?.spamFlagCount ?? 0}</td>
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
        {rows[0]?.healthReasons?.length ? `Example signals: ${rows.find((r) => r.healthReasons.length)?.healthReasons.join('; ')}` : 'Trends use 7- and 30-day windows from power-dialer attempts on each caller ID.'}
      </p>
    </Page>
  )
}
