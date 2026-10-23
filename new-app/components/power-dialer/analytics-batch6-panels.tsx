'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import type { AnalyticsPayload } from '@/components/power-dialer/analytics-range-shell'

export function FunnelPanel({ data }: { data: AnalyticsPayload }) {
  const f = data.funnel
  if (!f) return <p className="text-sm text-muted-foreground">No funnel data for this range.</p>
  return (
    <Panel title="Recovery funnel (M62)">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Dialed</dt><dd className="text-lg font-medium tabular-nums">{f.dialed}</dd></div>
        <div><dt className="text-muted-foreground">Connected</dt><dd className="text-lg font-medium tabular-nums">{f.connected}</dd></div>
        <div><dt className="text-muted-foreground">Conversations</dt><dd className="text-lg font-medium tabular-nums">{f.conversations}</dd></div>
        <div><dt className="text-muted-foreground">Dispositioned outcomes</dt><dd className="text-lg font-medium tabular-nums">{f.outcomes}</dd></div>
      </dl>
    </Panel>
  )
}

export function DispositionSummaryPanel({ data }: { data: AnalyticsPayload }) {
  const rows = data.dispositions || []
  return (
    <Panel title="Disposition summary (M61)">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dispositions recorded in this range.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((d) => (
            <li key={d.label} className="flex justify-between py-2">
              <span>{d.label}</span>
              <span className="tabular-nums text-muted-foreground">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function LeaderboardPanel({ data }: { data: AnalyticsPayload }) {
  const rows = data.leaderboard || []
  return (
    <Panel title="Live leaderboard (M65)">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rep activity in this range.</p>
      ) : (
        <ol className="divide-y text-sm">
          {rows.map((r, i) => (
            <li key={r.userId} className="flex justify-between gap-2 py-2">
              <span>
                <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                <span className="font-mono text-xs">{r.userId.slice(0, 8)}…</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {r.humanConversations} conv. · {r.connectRate}% · {r.attempts} dials
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function ProductivityPanel({ data }: { data: AnalyticsPayload }) {
  const p = data.productivity
  if (!p) return null
  return (
    <Panel title="Talk & wrap time">
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Talk minutes</dt><dd className="font-medium tabular-nums">{p.talkMinutes}</dd></div>
        <div><dt className="text-muted-foreground">Wrap minutes</dt><dd className="font-medium tabular-nums">{p.wrapMinutes}</dd></div>
        <div><dt className="text-muted-foreground">Calls / hour (avg)</dt><dd className="font-medium tabular-nums">{p.callsPerHour}</dd></div>
      </dl>
    </Panel>
  )
}

export function ConversionPanel({ data }: { data: AnalyticsPayload }) {
  const rows = data.conversions || []
  return (
    <Panel title="Conversion by campaign (M64)">
      <p className="mb-3 text-xs text-muted-foreground">
        Success uses disposition definitions marked completed or outcome class success — configure in Dispositions library.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dispositioned attempts in this range.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((c) => (
            <li key={c.campaignId} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/app/power-dialer/campaigns/${c.campaignId}`} className="font-medium text-primary hover:underline">
                {c.campaignName}
              </Link>
              <span className="text-muted-foreground tabular-nums">
                {c.conversions} / {c.dispositioned} ({c.conversionRatePct}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function ExportActions({ range }: { range: string }) {
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        render={<a href={`/api/phone/power-dialer/analytics/export?days=${days}`} />}
      >
        Export attempts CSV (M60)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        render={<a href={`/api/phone/power-dialer/analytics/export?days=${days}&kind=sessions`} />}
      >
        Export sessions CSV (M60)
      </Button>
    </div>
  )
}

type LiveRow = {
  sessionId: string
  campaignName: string
  repUserId: string | null
  status: string
  progressionPhase: string
  currentAttempt: { id: string; status: string } | null
}

export function LiveBoardPanel() {
  const [rows, setRows] = useState<LiveRow[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => {
      void fetch('/api/phone/power-dialer/analytics/live-board')
        .then(async (r) => {
          const j = await r.json()
          if (!r.ok || j.error) {
            throw new Error(typeof j.error === 'string' ? j.error : 'Could not load live board')
          }
          setError(null)
          setRows(j.data || [])
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load live board'))
    }
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])
  return (
    <Panel title="Live call board (M66)">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active dialer sessions right now.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((s) => (
            <li key={s.sessionId} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{s.campaignName}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.status} · {s.progressionPhase}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {s.repUserId?.slice(0, 8) || 'unassigned'} · {s.currentAttempt?.status || 'idle'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Supervisor listen / whisper / barge (M67): requires Telnyx supervisor monitor leg on the power-dialer WebRTC path — not provisioned in this release.
      </p>
    </Panel>
  )
}

type ScheduledReport = {
  id: string
  name: string
  cadence: string
  recipientsJson: string[]
  lastSentAt: string | null
}

export function ScheduledReportsPanel() {
  const [rows, setRows] = useState<ScheduledReport[]>([])
  const [email, setEmail] = useState('')
  const [gate, setGate] = useState<string | null>(null)

  const load = () => {
    void fetch('/api/phone/power-dialer/analytics/scheduled-reports')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok || j.error) {
          throw new Error(typeof j.error === 'string' ? j.error : 'Could not load scheduled reports')
        }
        setGate(null)
        setRows(j.data || [])
      })
      .catch((e) => setGate(e instanceof Error ? e.message : 'Could not load scheduled reports'))
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    const res = await fetch('/api/phone/power-dialer/analytics/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Weekly analytics', cadence: 'weekly', recipients: email ? [email] : [] }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setGate(j.error || 'Could not save schedule')
      return
    }
    setGate(null)
    load()
  }

  return (
    <Panel title="Scheduled email reports (M63)">
      <p className="mb-3 text-sm text-muted-foreground">
        Delivery uses Brevo transactional email. Production requires BREVO_API_KEY and a verified from address.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Recipient email</span>
        <input className="max-w-sm rounded-md border px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <Button type="button" size="sm" className="mt-2" onClick={() => void create()}>Save weekly schedule</Button>
      {gate && <p className="mt-2 text-sm text-destructive">{gate}</p>}
      <ul className="mt-4 divide-y text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between py-2">
            <span>{r.name} · {r.cadence}</span>
            <span className="text-muted-foreground">{r.lastSentAt ? `Last sent ${new Date(r.lastSentAt).toLocaleDateString()}` : 'Not sent yet'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
