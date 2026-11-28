'use client'

import { useMemo } from 'react'
import { gbUrl } from './gb14'
import { dayKey, isVideoWork, lastDays } from './ops-kit'
import { usePolled } from './use-ops-data'

export type CalItem = {
  at: number
  end?: number | null
  title: string
  kind: 'upcoming' | 'completed' | 'failed' | 'warning' | 'stopped' | string
  source?: string | null
  responsibility_id?: string | null
  run_id?: string | null
}

export type WeekStats = {
  days: { key: string; label: string }[]
  done: number[]
  warning: number[]
  failed: number[]
  totals: { done: number; warning: number; failed: number; all: number }
}

/** Last 7 days of work from GET /gb14/calendar (one-time tasks included), counted per local day. */
export function useWeekStats(): { stats: WeekStats | null; items: CalItem[] | null; loading: boolean } {
  const from = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - 6)
    return Math.floor(d.getTime() / 1000)
  }, [])
  const q = usePolled<{ items: CalItem[] }>(gbUrl(`calendar?from=${from}&to=${from + 8 * 86400}&tasks=1`), 60_000)
  const stats = useMemo<WeekStats | null>(() => {
    if (!q.data?.items) return null
    const days = lastDays(7)
    const idx = new Map(days.map((d, i) => [d.key, i]))
    const done = days.map(() => 0)
    const warning = days.map(() => 0)
    const failed = days.map(() => 0)
    for (const it of q.data.items) {
      if (isVideoWork(it.title)) continue
      const i = idx.get(dayKey(new Date(it.at * 1000)))
      if (i === undefined) continue
      if (it.kind === 'completed') done[i]++
      else if (it.kind === 'warning') warning[i]++
      else if (it.kind === 'failed') failed[i]++
    }
    const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
    const t = { done: sum(done), warning: sum(warning), failed: sum(failed), all: 0 }
    t.all = t.done + t.warning + t.failed
    return { days, done, warning, failed, totals: t }
  }, [q.data])
  return { stats, items: q.data?.items ? q.data.items.filter((i) => !isVideoWork(i.title)) : null, loading: q.loading }
}

export type GbOverview = {
  agent?: { online?: boolean; connected_apps?: number }
  needs_you_count?: number
  completed_this_week?: number
  responsibilities_count?: number
  responsibilities_total?: number
}

export function useGbOverview() {
  return usePolled<GbOverview>(gbUrl('overview'), 30_000)
}
