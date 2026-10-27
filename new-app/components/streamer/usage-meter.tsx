'use client'

import { useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

export type StreamUsageView = {
  usedHours: number
  idleSkippedHours?: number
  capHours: number | null
  limitReached?: boolean
  periodStart: string
  vodCount?: number
  gpuHours?: number
}

export function StreamerUsageMeter({ initial }: { initial?: StreamUsageView | null }) {
  const [usage, setUsage] = useState<StreamUsageView | null>(initial ?? null)
  useEffect(() => {
    void clipsFetch<StreamUsageView>('/api/streamer/usage')
      .then(setUsage)
      .catch(() => {
        if (!initial) setUsage(null)
      })
  }, [initial])
  if (!usage) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Stream usage unavailable right now.
      </div>
    )
  }
  const cap = usage.capHours
  const pct = cap ? Math.min(100, (usage.usedHours / cap) * 100) : 0
  const atLimit = usage.limitReached ?? (cap != null && usage.usedHours >= cap)
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
      <div className="flex justify-between gap-2 font-medium text-foreground">
        <span>Stream hours this month</span>
        <span className="tabular-nums">
          {usage.usedHours.toFixed(1)}
          {cap != null ? ` / ${cap} h` : ' h (no cap)'}
        </span>
      </div>
      {typeof usage.idleSkippedHours === 'number' && usage.idleSkippedHours > 0.05 ? (
        <p className="text-[11px]">
          Idle skipped (not counted): {usage.idleSkippedHours.toFixed(1)} h
        </p>
      ) : null}
      {atLimit ? (
        <p className="text-[11px] font-medium text-destructive">
          Monthly stream-hour limit reached. New imports pause until next month (no billing charge).
        </p>
      ) : null}
      {cap != null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${atLimit ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
