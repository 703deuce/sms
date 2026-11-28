'use client'

import { useMemo } from 'react'
import { gbUrl } from './gb14'
import { dayKey, lastDays } from './ops-kit'
import { usePolled } from './use-ops-data'

export type CalItem = {
  at: number
  end?: number | null
  title: string
  kind: 'upcoming' | 'completed' | 'failed' | 'warning' | 'stopped' | string
  source?: string | null
  channel?: string | null
  agent_id?: string | null
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
      if (it.channel === 'phone') continue // call follow-ups are counted on the Calls page, not as tasks
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
  return { stats, items: q.data?.items ? q.data.items.filter((i) => i.channel !== 'phone') : null, loading: q.loading }
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

export type RunFlags = {
  /** Runs the server marks as video or test work. */
  hiddenRuns: Set<string>
  hiddenConversations: Set<string>
  hiddenRoutines: Set<string>
  runAgent: Map<string, string>
  routineAgent: Map<string, string>
  ready: boolean
}

type FlagsDoc = {
  runs?: { id: string; conversation_id?: string | null; hidden?: boolean; agent_id?: string | null }[]
  routines?: { id: string; hidden?: boolean; agent_id?: string | null }[]
}

/** Which runs and responsibilities to hide (video or test work) and which agent owns each, from GET /gb14/run-flags. */
export function useRunFlags(): RunFlags {
  const q = usePolled<FlagsDoc>(gbUrl('run-flags'), 60_000)
  return useMemo<RunFlags>(() => {
    const hiddenRuns = new Set<string>()
    const hiddenConversations = new Set<string>()
    const hiddenRoutines = new Set<string>()
    const runAgent = new Map<string, string>()
    const routineAgent = new Map<string, string>()
    for (const r of q.data?.runs ?? []) {
      if (r.hidden) {
        hiddenRuns.add(r.id)
        if (r.conversation_id) hiddenConversations.add(r.conversation_id)
      }
      if (r.agent_id) runAgent.set(r.id, r.agent_id)
    }
    for (const r of q.data?.routines ?? []) {
      if (r.hidden) hiddenRoutines.add(r.id)
      if (r.agent_id) routineAgent.set(r.id, r.agent_id)
    }
    return { hiddenRuns, hiddenConversations, hiddenRoutines, runAgent, routineAgent, ready: !!q.data }
  }, [q.data])
}
