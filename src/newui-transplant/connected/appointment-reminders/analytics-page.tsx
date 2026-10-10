'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { ArStatGrid } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, Panel, Stat } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { OPUS_TABLE_HEAD, OPUS_META_STRIP } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { cn } from '@/lib/utils'

type AnalyticsPayload = {
  reminders: {
    total: number
    scheduled: number
    sent: number
    delivered: number
    failed: number
    suppressed: number
    byChannel: Record<string, number>
    byStep: Record<string, number>
  }
  appointments: {
    total: number
    confirmationResponses: number
    cancelRequests: number
    rescheduleRequests: number
    needsAttention: number
    noShow: number
    attended: number
    byService: Record<string, number>
  }
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export function AppointmentRemindersAnalyticsPage() {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [avgValue, setAvgValue] = useState('150')
  const [noShowRate, setNoShowRate] = useState('10')

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    const qs = new URLSearchParams({ from: range.from, to: range.to })
    fetch(`/api/appointment-reminders/analytics?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error('analytics failed')
        return r.json()
      })
      .then((json) => setData(json.data as AnalyticsPayload))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  const noShowCost = useMemo(() => {
    if (!data) return null
    const appts = data.appointments.total || 0
    const rate = Math.min(100, Math.max(0, Number(noShowRate) || 0)) / 100
    const value = Math.max(0, Number(avgValue) || 0)
    const estimatedNoShows = Math.round(appts * rate)
    return {
      estimatedNoShows,
      impact: estimatedNoShows * value,
    }
  }, [data, avgValue, noShowRate])

  if (loading && !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading analytics…
      </p>
    )
  }

  if (failed || !data) {
    return (
      <Callout tone="danger" icon={AlertTriangle} title="Could not load analytics">
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
          Try again
        </Button>
      </Callout>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">From</span>
          <Input
            type="date"
            className="h-10 w-[11rem]"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">To</span>
          <Input
            type="date"
            className="h-10 w-[11rem]"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <Button className="h-10" onClick={load} disabled={loading}>
          {loading ? 'Updating…' : 'Apply range'}
        </Button>
      </div>

      <ArStatGrid>
        <Stat label="Reminders (range)" value={String(data.reminders.total)} />
        <Stat label="Delivered" value={String(data.reminders.delivered)} />
        <Stat label="Failed / unknown" value={String(data.reminders.failed)} />
        <Stat label="Suppressed" value={String(data.reminders.suppressed)} />
        <Stat label="Confirmations" value={String(data.appointments.confirmationResponses)} />
        <Stat label="Needs attention" value={String(data.appointments.needsAttention)} />
      </ArStatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By channel" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Channel</th>
                <th scope="col" className={cn(th, 'text-right')}>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.reminders.byChannel).map(([ch, n]) => (
                <tr key={ch} className="border-t">
                  <td className={td}>{ch.toUpperCase()}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{String(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="By reminder step" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Step</th>
                <th scope="col" className={cn(th, 'text-right')}>Dispatches</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.reminders.byStep).map(([step, n]) => (
                <tr key={step} className="border-t">
                  <td className={td}>{step}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{String(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="No-show cost estimate" description="Illustrative only — based on your inputs, not billing data.">
        <div className={OPUS_META_STRIP + ' mb-4'}>
          Uses appointment count in range × estimated no-show rate × average appointment value.
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Avg. appointment value ($)</span>
            <Input value={avgValue} onChange={(e) => setAvgValue(e.target.value)} className="h-10" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Estimated no-show rate (%)</span>
            <Input value={noShowRate} onChange={(e) => setNoShowRate(e.target.value)} className="h-10" />
          </label>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Estimated impact</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {noShowCost ? `$${noShowCost.impact.toLocaleString()}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              ~{noShowCost?.estimatedNoShows ?? 0} no-shows · {data.appointments.noShow} recorded in range
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
